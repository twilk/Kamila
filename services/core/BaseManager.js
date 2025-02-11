import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { TimeoutError } from './errors/TimeoutError.js';
import { getManagerTimeout, getRetryDelay, MAX_RETRY_ATTEMPTS } from '../../config/timeouts.js';
import { environment } from './environment.js';

/**
 * @enum {string}
 */
export const InitState = {
    IDLE: 'IDLE',
    INITIALIZING: 'INITIALIZING',
    INITIALIZED: 'INITIALIZED',
    READY: 'READY',
    FAILED: 'FAILED'
};

/**
 * Base class for all managers
 */
export class BaseManager {
    static _errorHandler = null;
    
    #name;
    #initState = InitState.IDLE;
    #readyPromise = null;
    #readyResolve = null;
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
        this.#readyPromise = new Promise(resolve => {
            this.#readyResolve = resolve;
        });
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
        return this.#initState === InitState.INITIALIZED || this.#initState === InitState.READY;
    }

    /**
     * Check if manager is ready
     * @returns {boolean}
     */
    isReady() {
        return this.#initState === InitState.READY;
    }

    /**
     * Wait for manager to be ready
     * @returns {Promise<void>}
     */
    async waitForReady() {
        if (this.#initState === InitState.READY) {
            return Promise.resolve();
        }
        return this.#readyPromise;
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
            // If already ready or initialized, return immediately
            if (this.#initState === InitState.READY || this.#initState === InitState.INITIALIZED) {
                return true;
            }

            // If currently initializing, wait for completion
            if (this.#initState === InitState.INITIALIZING) {
                await this.waitForReady();
                return true;
            }

            // Check for initialization cycles
            if (this.#initializationStack.has(this.#name)) {
                throw new Error(`Circular dependency detected: ${Array.from(this.#initializationStack).join(' -> ')} -> ${this.#name}`);
            }

            this.#initState = InitState.INITIALIZING;
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

            // Run initialization
            const success = await this.onInitialize();
            if (!success) {
                this.#initState = InitState.FAILED;
                throw new Error(`${this.#name} initialization returned false`);
            }

            // Mark as initialized
            this.#initState = InitState.INITIALIZED;
            
            // Wait for dependencies to be ready
            for (const dependency of this._dependencies) {
                await dependency.waitForReady();
            }

            // Mark as ready
            this.#initState = InitState.READY;
            this.#readyResolve();
            
            const duration = performance.now() - this._startTime;
            this.log(LogLevel.SUCCESS, `✅ ${this.#name} initialized in ${duration.toFixed(2)}ms`);
            
            // Clear from initialization stack after success
            this.#initializationStack.delete(this.#name);
            return true;
        } catch (error) {
            // Clear from initialization stack on error
            this.#initializationStack.delete(this.#name);
            this.#initState = InitState.FAILED;
            
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
     * Execute function with retry logic
     * @template T
     * @param {function(): Promise<T>} fn - Function to execute
     * @param {Object} options - Retry options
     * @param {number} [options.maxRetries=3] - Maximum number of retries
     * @param {number} [options.baseDelay=1000] - Base delay between retries in ms
     * @param {number} [options.maxDelay=10000] - Maximum delay between retries in ms
     * @param {number} [options.timeout] - Operation timeout in ms
     * @param {function(Error, number): boolean} [options.shouldRetry] - Function to determine if retry should be attempted
     * @param {function(number): number} [options.backoff] - Custom backoff strategy
     * @returns {Promise<T>}
     */
    async executeWithRetry(fn, options = {}) {
        const {
            maxRetries = MAX_RETRY_ATTEMPTS,
            baseDelay = getRetryDelay(),
            maxDelay = 10000,
            timeout,
            shouldRetry = (error) => {
                // Don't retry on certain errors
                if (error instanceof TimeoutError) return false;
                if (error.message.includes('not authorized')) return false;
                if (error.message.includes('invalid token')) return false;
                return true;
            },
            backoff = (attempt) => Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
        } = options;

        let attempt = 1;
        let lastError = null;
        
        const startTime = performance.now();
        
        while (attempt <= maxRetries) {
            try {
                // If timeout is specified, wrap function with timeout
                if (timeout) {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new TimeoutError(
                                `Operation timed out after ${timeout}ms`,
                                this.name,
                                timeout
                            ));
                        }, timeout);
                    });

                    return await Promise.race([fn(), timeoutPromise]);
                }
                
                return await fn();
            } catch (error) {
                lastError = error;
                const duration = performance.now() - startTime;
                
                if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
                    this.log(LogLevel.ERROR, `❌ All retry attempts failed (${attempt}/${maxRetries}) after ${duration.toFixed(2)}ms`, {
                        error: error.message,
                        manager: this.name,
                        attempts: attempt,
                        duration: `${duration.toFixed(2)}ms`
                    });
                    throw error;
                }

                const delay = backoff(attempt);
                
                this.log(LogLevel.WARN, `⚠️ Operation failed, retrying in ${delay}ms (${attempt}/${maxRetries})`, {
                    error: error.message,
                    manager: this.name,
                    attempt,
                    delay,
                    duration: `${duration.toFixed(2)}ms`
                });

                // Emit retry event
                this.emit('operation:retry', {
                    manager: this.name,
                    attempt,
                    delay,
                    error: error.message,
                    duration
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
            }
        }

        // This should never happen, but just in case
        throw lastError || new Error('Retry failed for unknown reason');
    }

    /**
     * Initialize with retry mechanism
     * @returns {Promise<boolean>}
     */
    async initializeWithRetry() {
        const timeout = getManagerTimeout(this.name);
        
        return this.executeWithRetry(
            async () => {
                const success = await this.initialize();
                if (!success) {
                    throw new Error(`${this.name} initialization returned false`);
                }
                return success;
            },
            {
                maxRetries: MAX_RETRY_ATTEMPTS,
                baseDelay: getRetryDelay(),
                timeout,
                shouldRetry: (error) => {
                    // Don't retry on certain errors
                    if (error instanceof TimeoutError) return false;
                    if (error.message.includes('already initialized')) return false;
                    if (error.message.includes('circular dependency')) return false;
                    return true;
                }
            }
        );
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
            this.#initState = InitState.IDLE;
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
     * @param {Error} error - Error object
     * @param {string} type - Error type
     * @param {string} severity - Error severity
     * @param {Object} context - Error context
     */
    handleError(error, type, severity, context = {}) {
        const timestamp = new Date().toISOString();
        const prefix = `${timestamp} [${this.name}]`;
        
        console.groupCollapsed(`${prefix} ❌ Error: ${error.message}`);
        console.error('Error details:', error);
        console.dir({ type, severity, context }, { depth: null, colors: true });
        console.groupEnd();
        
        if (this.errorHandler) {
            this.errorHandler.handle(error, type, severity, {
                ...context,
                manager: this.name
            });
        }
    }

    /**
     * Log a message with timestamp and manager name
     * @param {LogLevel} level - Log level
     * @param {string} message - Message to log
     * @param {Object} [data] - Optional data to log
     */
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `${timestamp} [${this.name}]`;
        
        // Format the message
        let formattedMessage = `${prefix} ${message}`;
        
        // If there's data, format it properly
        if (data) {
            // For objects that need special handling
            if (typeof data === 'object') {
                console.groupCollapsed(formattedMessage);
                console.dir(data, { depth: null, colors: true });
                console.groupEnd();
                return;
            }
        }

        // For simple messages without data
        console.log(formattedMessage);
    }

    /**
     * Set error handler
     * @param {ErrorHandler} handler Error handler instance
     */
    static setErrorHandler(handler) {
        BaseManager._errorHandler = handler;
    }

    /**
     * Emit an event with data
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    emit(eventName, data = {}) {
        const timestamp = new Date().toISOString();
        const prefix = `${timestamp} [${this.name}]`;
        
        console.groupCollapsed(`${prefix} 📢 Emitted event: ${eventName}`);
        console.dir(data, { depth: null, colors: true });
        console.groupEnd();
        
        if (this.eventManager) {
            this.eventManager.emit(eventName, data);
        }
    }
} 