import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { TimeoutError } from './errors/TimeoutError.js';
import { getManagerTimeout, getRetryDelay, MAX_RETRY_ATTEMPTS } from '../../config/timeouts.js';
import { environment } from './environment.js';

/**
 * Base class for all managers
 */
export class BaseManager {
    static _errorHandler = null;
    
    #name;
    #isInitialized = false;
    #retryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 5000
    };
    
    #initializationStack = new Set();
    
    constructor(name) {
        if (!name) {
            throw new Error('Manager name is required');
        }
        this.#name = name;
        this._environment = environment;
        this._disposed = false;
        this._dependencies = new Set();
        this._startTime = 0;
        this._handlingError = false;
    }
    
    /**
     * Get manager name
     * @returns {string}
     */
    get name() {
        return this.#name;
    }
    
    /**
     * Check if manager is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.#isInitialized;
    }

    /**
     * Get a dependency by name
     * @param {string} name - Name of the dependency to get
     * @returns {BaseManager} The dependency manager instance
     * @throws {Error} If dependency not found
     */
    getDependency(name) {
        const dep = Array.from(this._dependencies)
            .find(d => d.constructor.name === name || d.name === name);
            
        if (!dep) {
            throw new Error(`Dependency ${name} not found in ${this.#name}`);
        }
        return dep;
    }

    /**
     * Initialize the manager
     * @param {Object} config Configuration object
     * @returns {Promise<boolean>} Success status
     */
    async initialize(config = {}) {
        try {
            // Check for initialization cycles
            if (this.#initializationStack.has(this.#name)) {
                throw new Error(`Circular dependency detected: ${Array.from(this.#initializationStack).join(' -> ')} -> ${this.#name}`);
            }
            this.#initializationStack.add(this.#name);

            this.log(LogLevel.INFO, `🚀 Starting initialization of ${this.#name}`);
            this._startTime = performance.now();

            // Set environment from config or use default
            this._environment = config.environment || environment;
            
            // Initialize dependencies first
            for (const dependency of this._dependencies) {
                if (!dependency.isInitialized()) {
                    this.log(LogLevel.INFO, `⏳ Waiting for dependency: ${dependency.name}`);
                    const success = await dependency.initialize(config);
                    if (!success) {
                        throw new Error(`Failed to initialize dependency: ${dependency.name}`);
                    }
                }
            }

            // Initialize this manager
            const success = await this.onInitialize();
            if (!success) {
                throw new Error(`${this.#name} initialization returned false`);
            }

            this.#isInitialized = true;
            const duration = performance.now() - this._startTime;
            this.log(LogLevel.SUCCESS, `✅ ${this.#name} initialized in ${duration.toFixed(2)}ms`);
            
            // Clear from initialization stack after success
            this.#initializationStack.delete(this.#name);
            return true;
        } catch (error) {
            // Clear from initialization stack on error
            this.#initializationStack.delete(this.#name);
            
            const duration = performance.now() - this._startTime;
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize',
                manager: this.#name,
                duration: `${duration.toFixed(2)}ms`,
                dependencies: Array.from(this._dependencies).map(dep => dep.name)
            });
            return false;
        }
    }

    /**
     * Initialize with retry mechanism
     * @returns {Promise<boolean>}
     */
    async initializeWithRetry() {
        let attempt = 0;
        
        while (attempt < this.#retryConfig.maxRetries) {
            try {
                this.log(LogLevel.INFO, `🔄 Initializing ${this.#name} (attempt ${attempt + 1}/${this.#retryConfig.maxRetries})`);
                
                const success = await this.initialize();
                if (success) {
                    this.#isInitialized = true;
                    this.log(LogLevel.SUCCESS, `✅ ${this.#name} initialization successful`);
                    return true;
                }
                
                throw new Error(`${this.#name} initialization returned false`);
            } catch (error) {
                attempt++;
                
                if (attempt >= this.#retryConfig.maxRetries) {
                    this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                        method: 'initializeWithRetry',
                        manager: this.#name,
                        attempts: attempt
                    });
                    return false;
                }
                
                const delay = Math.min(
                    this.#retryConfig.baseDelay * Math.pow(2, attempt),
                    this.#retryConfig.maxDelay
                );
                
                this.log(LogLevel.WARN, `⚠️ ${this.#name} initialization failed, retrying in ${delay}ms...`, {
                    attempt,
                    error: error.message
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return false;
    }

    /**
     * Initialize with timeout
     * @private
     * @param {Function} initFn Initialization function
     * @param {string} managerName Manager name for error reporting
     * @returns {Promise<boolean>}
     */
    async #initializeWithTimeout(initFn, managerName) {
        const timeout = getManagerTimeout(managerName);
        
        try {
            const result = await Promise.race([
                initFn(),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new TimeoutError(
                            `Initialization timed out after ${timeout}ms`,
                            managerName,
                            timeout
                        ));
                    }, timeout);
                })
            ]);

            return result;
        } catch (error) {
            if (error instanceof TimeoutError) {
                throw error;
            }
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize',
                manager: managerName
            });
            return false;
        }
    }

    /**
     * Override this method to implement initialization logic
     * @protected
     * @returns {Promise<boolean>} Success status
     */
    async onInitialize() {
        return true;
    }

    /**
     * Add a dependency
     * @param {BaseManager} manager Manager instance
     */
    addDependency(manager) {
        if (manager instanceof BaseManager) {
            this._dependencies.add(manager);
        }
    }

    /**
     * Clean up manager resources
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            this.#isInitialized = false;
            this._disposed = true;
            this._dependencies.clear();
            this.log(LogLevel.INFO, `${this.#name} disposed`);
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.MEDIUM, {
                method: 'dispose',
                manager: this.#name
            });
        }
    }

    /**
     * Handle an error
     * @param {Error} error Error object
     * @param {ErrorType} type Error type
     * @param {ErrorSeverity} severity Error severity
     * @param {Object} context Additional context
     */
    handleError(error, type = ErrorType.RUNTIME, severity = ErrorSeverity.MEDIUM, context = {}) {
        if (BaseManager._errorHandler) {
            BaseManager._errorHandler.handle(error, type, severity, {
                ...context,
                manager: this.#name,
                environment: this._environment.isDevelopment ? 'development' : 'production'
            });
        } else {
            console.error(`[${this.#name}]`, error, context);
        }
    }

    /**
     * Log a message with specified level
     * @param {LogLevel} level Log level
     * @param {string} message Message to log
     * @param {Object} [data] Additional data to log
     */
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${this.constructor.name}]`;
        
        // Format message
        let formattedMessage = `${prefix} ${message}`;
        
        // Add data if present
        if (data) {
            if (typeof data === 'object') {
                // If data is an object, format it nicely
                if (Array.isArray(data)) {
                    console.log(`${timestamp} ${formattedMessage}:`);
                    console.table(data);
                    return;
                } else {
                    // For objects, show them in a formatted way
                    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
                        acc[key] = value?.toString() || value;
                        return acc;
                    }, {});
                    console.log(`${timestamp} ${formattedMessage}:`, cleanData);
                    return;
                }
            } else {
                formattedMessage += ` ${data}`;
            }
        }

        // Log based on level
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(`${timestamp} ${formattedMessage}`);
                break;
            case LogLevel.INFO:
                console.info(`${timestamp} ${formattedMessage}`);
                break;
            case LogLevel.WARNING:
                console.warn(`${timestamp} ${formattedMessage}`);
                break;
            case LogLevel.ERROR:
                console.error(`${timestamp} ${formattedMessage}`);
                break;
            case LogLevel.SUCCESS:
                console.log(`${timestamp} ✅ ${formattedMessage}`);
                break;
            default:
                console.log(`${timestamp} ${formattedMessage}`);
        }
    }

    /**
     * Set error handler
     * @param {ErrorHandler} handler Error handler instance
     */
    static setErrorHandler(handler) {
        BaseManager._errorHandler = handler;
    }

    /**
     * Set initialization state
     * @protected
     * @param {boolean} state
     */
    _setInitialized(state) {
        this.#isInitialized = state;
    }
} 