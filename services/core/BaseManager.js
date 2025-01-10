import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { IInitializable } from './IInitializable.js';

/**
 * Base class for all managers
 * @implements {IInitializable}
 */
export class BaseManager extends IInitializable {
    static initLogger = null;
    static metricsManager = null;

    constructor(dependencies = []) {
        super();
        this._initialized = false;
        this._dependencies = dependencies;
        this.eventListeners = new Map();
        this._errorHandler = null;
        this.dependencies = new Set();
        this.dependents = new Set();
    }

    /**
     * Get the name of the manager
     * @returns {string}
     */
    get name() {
        return this.constructor.name;
    }

    /**
     * Set the error handler for this manager
     * @param {ErrorHandler} errorHandler
     */
    setErrorHandler(errorHandler) {
        this._errorHandler = errorHandler;
    }

    /**
     * Handle an error
     * @param {Error} error
     * @param {ErrorType} type
     * @param {ErrorSeverity} severity
     * @param {Object} context
     */
    handleError(error, type = ErrorType.UNKNOWN, severity = ErrorSeverity.ERROR, context = {}) {
        if (this._errorHandler) {
            return this._errorHandler.handleError(error, type, severity, {
                manager: this.name,
                ...context
            });
        } else {
            console.error(`[${this.name}] Error:`, error, context);
            return error;
        }
    }

    /**
     * Check if manager is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this._initialized;
    }

    /**
     * Get manager dependencies
     * @returns {Array<string>}
     */
    getDependencies() {
        return this._dependencies.map(dep => dep.name);
    }

    /**
     * Initialize the manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (this._initialized) {
            return true;
        }

        BaseManager.initLogger.startInit(this.name);
        const startTime = performance.now();

        try {
            // Initialize dependencies first
            for (const dependency of this._dependencies) {
                if (!dependency.isInitialized()) {
                    await BaseManager.metricsManager.trackOperation(
                        `${dependency.name}_init`,
                        () => dependency.initialize()
                    );
                }
            }

            // Perform initialization
            await BaseManager.metricsManager.trackOperation(
                `${this.name}_init`,
                () => this._doInitialize()
            );
            
            this._initialized = true;
            const duration = performance.now() - startTime;
            BaseManager.metricsManager.trackTiming(`${this.name}_init_time`, duration);
            BaseManager.initLogger.endInit(this.name, true);
            return true;
        } catch (error) {
            const duration = performance.now() - startTime;
            BaseManager.metricsManager.trackTiming(`${this.name}_init_time`, duration);
            BaseManager.initLogger.endInit(this.name, false, error.message);
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Implementation specific initialization
     * @protected
     * @returns {Promise<void>}
     */
    async _doInitialize() {
        // To be implemented by derived classes
    }

    /**
     * Dispose of manager resources
     * @returns {Promise<boolean>}
     */
    async dispose() {
        if (!this._initialized) {
            return true;
        }

        try {
            // Dispose dependents first
            for (const dependent of this.dependents) {
                await BaseManager.metricsManager.trackOperation(
                    `${dependent.name}_dispose`,
                    () => dependent.dispose()
                );
            }

            // Do manager-specific disposal
            await BaseManager.metricsManager.trackOperation(
                `${this.name}_dispose`,
                () => this._doDispose()
            );

            // Clear event listeners
            this.eventListeners.clear();
            
            this._initialized = false;
            
            // Clear dependencies
            this.dependencies.clear();
            this.dependents.clear();
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
            return false;
        }
    }

    /**
     * Implementation specific disposal
     * @protected
     * @returns {Promise<void>}
     */
    async _doDispose() {
        // To be implemented by derived classes
    }

    /**
     * Add event listener
     * @param {string} eventName
     * @param {Function} callback
     */
    on(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, new Set());
        }
        this.eventListeners.get(eventName).add(callback);
    }

    /**
     * Remove event listener
     * @param {string} eventName
     * @param {Function} callback
     */
    off(eventName, callback) {
        if (this.eventListeners.has(eventName)) {
            this.eventListeners.get(eventName).delete(callback);
        }
    }

    /**
     * Emit event
     * @param {string} eventName
     * @param {*} data
     */
    emit(eventName, data = {}) {
        if (this.eventListeners.has(eventName)) {
            this.eventListeners.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.handleError(error, ErrorType.EVENT, ErrorSeverity.WARNING, {
                        method: 'emit',
                        eventName,
                        data
                    });
                }
            });
        }
    }

    /**
     * Send message to background script
     * @param {Object} message
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async sendMessage(message, options = {}) {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            timeout = 5000
        } = options;

        return new Promise(async (resolve, reject) => {
            let attempts = 0;
            const timeoutId = setTimeout(() => {
                reject(new Error('Message sending timeout'));
            }, timeout);

            const trySend = async () => {
                try {
                    const response = await chrome.runtime.sendMessage(message);
                    clearTimeout(timeoutId);
                    resolve(response);
                } catch (error) {
                    attempts++;
                    if (attempts >= maxRetries) {
                        clearTimeout(timeoutId);
                        reject(error);
                        return;
                    }
                    
                    // Check if connection error
                    if (error.message.includes('Receiving end does not exist')) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        await trySend();
                    } else {
                        clearTimeout(timeoutId);
                        reject(error);
                    }
                }
            };

            await trySend();
        });
    }

    /**
     * Add a dependency
     * @param {BaseManager} manager 
     */
    addDependency(manager) {
        if (manager instanceof BaseManager) {
            this.dependencies.add(manager);
            manager.dependents.add(this);
        }
    }

    /**
     * Remove a dependency
     * @param {BaseManager} manager 
     */
    removeDependency(manager) {
        this.dependencies.delete(manager);
        manager.dependents.delete(this);
    }

    /**
     * Get initialization metrics
     */
    static getInitMetrics() {
        return {
            logs: BaseManager.initLogger.getLogs(),
            metrics: BaseManager.metricsManager.getMetrics()
        };
    }

    /**
     * Get initialization logs
     */
    static getInitLogs() {
        return BaseManager.initLogger.getLogs();
    }
} 