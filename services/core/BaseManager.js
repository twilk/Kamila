import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { IInitializable } from './IInitializable.js';

/**
 * Base class for all managers
 * @implements {IInitializable}
 */
export class BaseManager extends IInitializable {
    static INIT_TIMEOUT = 5000; // 5 second timeout
    static initLogger = null;
    static metricsManager = null;

    constructor(dependencies = []) {
        super();
        this._initialized = false;
        this._initializing = false;
        this._dependencies = dependencies;
        this._lazyInit = false;
        this._initPromise = null;
        this.eventListeners = new Map();
        this._errorHandler = null;
        this.dependencies = new Set();
        this.dependents = new Set();
    }

    setLazyInit(lazy = true) {
        this._lazyInit = lazy;
        return this;
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
     * Initialize the manager with timeout and error handling
     * @returns {Promise<boolean>}
     */
    async initialize() {
        // Return existing initialization if in progress
        if (this._initPromise) {
            return this._initPromise;
        }

        // Skip if already initialized
        if (this._initialized) {
            return true;
        }

        // Skip if lazy init and not explicitly called
        if (this._lazyInit && !this._initializing) {
            return true;
        }

        this._initializing = true;
        BaseManager.initLogger.startInit(this.name);
        const startTime = performance.now();

        // Create initialization promise with timeout
        this._initPromise = Promise.race([
            this._doInitialize().then(() => true),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Initialization timeout for ${this.name}`)), 
                BaseManager.INIT_TIMEOUT)
            )
        ]).catch(error => {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR, {
                method: 'initialize',
                manager: this.name
            });
            return false;
        }).finally(() => {
            const duration = performance.now() - startTime;
            BaseManager.metricsManager.trackTiming(`${this.name}_init_time`, duration);
            this._initializing = false;
            this._initPromise = null;
        });

        return this._initPromise;
    }

    /**
     * Protected initialization implementation
     * @protected
     * @returns {Promise<void>}
     */
    async _doInitialize() {
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
                () => this.onInitialize()
            );
            
            this._initialized = true;
            BaseManager.initLogger.endInit(this.name, true);
        } catch (error) {
            BaseManager.initLogger.endInit(this.name, false, error.message);
            throw error;
        }
    }

    /**
     * Hook for actual initialization code
     * @protected
     * @returns {Promise<void>}
     */
    async onInitialize() {
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
     * Send message to background script with retry mechanism
     * @param {Object} message - Message to send
     * @param {Object} options - Options for sending
     * @returns {Promise<*>}
     */
    async sendMessage(message, options = {}) {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            timeout = 5000
        } = options;

        let attempts = 0;
        let lastError = null;

        while (attempts < maxRetries) {
            try {
                const response = await Promise.race([
                    new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage(message, response => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve(response);
                            }
                        });
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Message timeout')), timeout)
                    )
                ]);
                
                return response;
            } catch (error) {
                lastError = error;
                attempts++;
                
                // Log the attempt
                console.log(`[RETRY] Attempt ${attempts}/${maxRetries} failed:`, error.message);
                
                // If it's not a connection error, don't retry
                if (!error.message.includes('Receiving end does not exist')) {
                    break;
                }
                
                // Wait before retrying
                if (attempts < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
                }
            }
        }

        // All retries failed
        console.error('[ERROR] All message sending attempts failed:', lastError);
        throw lastError;
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

    /**
     * Get a specific dependency by its class
     * @param {Function} dependencyClass - The class of the dependency to get
     * @returns {BaseManager} The dependency instance
     * @throws {Error} If dependency not found
     */
    getDependency(dependencyClass) {
        for (const dependency of this.dependencies) {
            if (dependency instanceof dependencyClass) {
                return dependency;
            }
        }
        throw new Error(`Dependency ${dependencyClass.name} not found in ${this.name}`);
    }
} 