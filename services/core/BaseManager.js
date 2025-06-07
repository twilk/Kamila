import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { TimeoutError } from './errors/TimeoutError.js';
import { getManagerTimeout, getRetryDelay, MAX_RETRY_ATTEMPTS } from '../../config/timeouts.js';

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
    /** @type {InitLogger} */
    static #initLogger = {
        error: (msg, error, data) => {
            console.error(`[BaseManager] ${msg}`, error, data);
        },
        info: (msg, data) => {
            console.info(`[BaseManager] ${msg}`, data);
        },
        warn: (msg, data) => {
            console.warn(`[BaseManager] ${msg}`, data);
        },
        debug: (msg, data) => {
            console.debug(`[BaseManager] ${msg}`, data);
        }
    };

    /** @private */
    static #globalRegistry = null;

    /** @private */
    #instanceRegistry = null;
    #name = null;
    #dependencies = new Set();
    #initialized = false;
    #initializing = false;
    #lastError = null;
    #initStartTime = 0;
    #initEndTime = 0;
    #legacyMode = false;
    #ready = false;
    #initializationPromise = null;
    #readyPromise = null;
    #disposed = false;
    #readyResolve = null;
    #retryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 5000
    };
    #queueProcessInterval = null;
    #isProcessingQueue = false;
    #eventQueue = [];

    /** @protected */
    _metrics = {
        initTime: 0,
        initAttempts: 0,
        lastInitAttempt: null,
        errors: []
    };

    /**
     * @param {ManagerRegistry} registry
     * @param {string} name
     */
    constructor(registry = null, name = null) {
        this.#instanceRegistry = registry;
        this.#name = name || this.constructor.name.toLowerCase().replace('manager', '');
        this.#legacyMode = !registry;
        
        if (!this.#legacyMode && !registry) {
            throw new Error('Registry is required in non-legacy mode');
        }
        
        if (!this.#name) {
            throw new Error('Manager name is required');
        }
        
        BaseManager.#globalRegistry = registry;
        this.#readyPromise = new Promise(resolve => {
            this.#readyResolve = resolve;
        });
        
        // Start queue processor
        this.#startQueueProcessor();
    }
    
    /**
     * Get manager name
     * @returns {string}
     */
    get name() {
        return this.#name;
    }
    
    /**
     * Get last error
     * @returns {Error|null}
     */
    getLastError() {
        return this.#lastError;
    }

    /**
     * Get initialization time in ms
     * @returns {number}
     */
    getInitializationTime() {
        if (!this.#initEndTime || !this.#initStartTime) return 0;
        return this.#initEndTime - this.#initStartTime;
    }

    /**
     * Add dependency
     * @param {string} name
     */
    addDependency(name) {
        if (this.#legacyMode) return;
        this.#dependencies.add(name);
    }

    /**
     * Get dependencies
     * @returns {string[]}
     */
    getDependencies() {
        return Array.from(this.#dependencies);
    }

    /**
     * Get dependency
     * @param {string} name
     * @returns {Promise<Object>}
     */
    async getDependency(name) {
        if (this.#legacyMode) return null;
        return this.#instanceRegistry.get(name);
    }

    /**
     * Check if manager is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.#initialized;
    }

    /**
     * Check if manager is ready
     * @returns {boolean}
     */
    isReady() {
        return this.#initialized && !this.#lastError;
    }

    /**
     * Get manager metrics
     * @returns {Object}
     */
    getMetrics() {
        return { ...this._metrics };
    }

    /**
     * Set registry for all managers
     * @param {ManagerRegistry} registry Manager registry
     */
    static setRegistry(registry) {
        if (!registry) {
            throw new Error('Registry is required');
        }
        BaseManager.#globalRegistry = registry;
    }

    /**
     * Get registry instance
     * @protected
     * @returns {ManagerRegistry}
     */
    static getRegistry() {
        return BaseManager.#globalRegistry;
    }

    /**
     * Setup event listeners
     * @protected
     */
    _setupEventListeners() {
        // Optional override in child classes
    }

    /**
     * Initialize manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (this.#initialized) return true;
        if (this.#initializing) return false;

        try {
            this.#initializing = true;
            this.#initStartTime = Date.now();

            // Check dependencies
            if (!this.#legacyMode) {
                for (const dep of this.#dependencies) {
                    const manager = await this.#instanceRegistry.get(dep);
                    if (!manager?.isInitialized()) {
                        throw new Error(`Dependency ${dep} not initialized`);
                    }
                }
            }

            // Setup event listeners
            await this._setupEventListeners();

            // Initialize
            const result = await this._initialize();
            this.#initialized = result === true;
            this.#initEndTime = Date.now();

            return this.#initialized;
        } catch (error) {
            this.#lastError = error;
            this.#initialized = false;
            this.#initEndTime = Date.now();
            
            // Log error using internal logger
            BaseManager.#initLogger.error(
                `Failed to initialize ${this.#name}`,
                error,
                {
                    manager: this.#name,
                    dependencies: Array.from(this.#dependencies),
                    time: this.getInitializationTime()
                }
            );
            
            throw error;
        } finally {
            this.#initializing = false;
        }
    }

    /**
     * Initialize manager implementation
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        throw new Error('_initialize() must be implemented');
    }

    /**
     * Dispose manager
     */
    dispose() {
        this.#initialized = false;
        this.#initializing = false;
        this.#lastError = null;
        this.#initStartTime = 0;
        this.#initEndTime = 0;
    }

    /**
     * Wait for manager to be ready
     * @param {number} timeout Timeout in milliseconds
     * @returns {Promise<boolean>}
     */
    async waitForReady(timeout = 30000) {
        if (this.#ready) return true;
        
        if (!this.#readyPromise) {
            this.#readyPromise = this.#waitForReadyInternal(timeout);
        }
        
        return this.#readyPromise;
    }

    /**
     * Wait for all dependencies to be ready
     * @private
     */
    async waitForDependencies() {
        const dependencies = Array.from(this.#dependencies);
        if (dependencies.length === 0) return;

        const promises = dependencies.map(async (name) => {
            const dependency = await this.getDependency(name);
            if (!dependency) {
                throw new Error(`Dependency ${name} not found for ${this.#name}`);
            }
            await dependency.waitForReady();
        });

        await Promise.all(promises);
    }

    /**
     * Clean up manager resources
     * @returns {Promise<void>}
     */
    async dispose() {
        if (this.#disposed) return;
        
        try {
            this.#disposed = true;
            this.#initialized = false;
            this.#ready = false;
            this.#lastError = null;
            this.#initStartTime = 0;
            this.#initEndTime = 0;
            
            await this._dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.MEDIUM);
        }
    }

    /**
     * Execute with retry
     * @private
     */
    async #executeWithRetry(fn, context) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.#retryConfig.maxRetries; attempt++) {
            try {
                const result = await fn();
                return result;
            } catch (error) {
                lastError = error;
                this._metrics.retryCount++;
                
                if (attempt < this.#retryConfig.maxRetries) {
                    const delay = Math.min(
                        this.#retryConfig.baseDelay * Math.pow(2, attempt - 1),
                        this.#retryConfig.maxDelay
                    );
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        throw new Error(
            `${context} failed after ${this.#retryConfig.maxRetries} attempts: ${lastError?.message}`
        );
    }

    /**
     * Handle initialization error
     * @private
     */
    #handleInitError(error) {
        this.#initialized = false;
        this.#ready = false;
        this.#lastError = error;
        this._metrics.errorCount++;
    }

    /**
     * Handle error
     * @private
     */
    #handleError(error, type, severity) {
        this._metrics.errorCount++;
        
        // Get error handler if available
        this.getDependency('error')
            .then(handler => handler.handle(error, type, severity))
            .catch(err => console.error('Failed to handle error:', err));
    }

    /**
     * Wait for ready state
     * @private
     */
    async #waitForReadyInternal(timeout) {
        const start = Date.now();
        
        while (!this.#ready && !this.#disposed) {
            if (Date.now() - start > timeout) {
                throw new TimeoutError(`${this.#name} ready timeout after ${timeout}ms`);
            }
            await new Promise(r => setTimeout(r, 100));
        }
        
        return this.#ready;
    }

    /**
     * Override this method to implement disposal logic
     * @protected
     * @returns {Promise<void>}
     */
    async _dispose() {
        // Optional override
    }

    /**
     * Start event queue processor
     * @private
     */
    #startQueueProcessor() {
        if (this.#queueProcessInterval) {
            clearInterval(this.#queueProcessInterval);
        }
        
        this.#queueProcessInterval = setInterval(() => {
            this.#processEventQueue().catch(error => {
                this.handleError(error, ErrorType.EVENT_QUEUE, ErrorSeverity.MEDIUM);
            });
        }, 100); // Process queue every 100ms
    }

    /**
     * Process event queue
     * @private
     */
    async #processEventQueue() {
        if (this.#isProcessingQueue || !this.isReady() || this.#eventQueue.length === 0) {
            return;
        }

        try {
            this.#isProcessingQueue = true;
            
            while (this.#eventQueue.length > 0) {
                const { eventName, data, timestamp } = this.#eventQueue.shift();
                
                // Skip old events (older than 5 minutes)
                if (Date.now() - timestamp > 5 * 60 * 1000) {
                    continue;
                }
                
                try {
                    const eventManager = await managers.eventManager;
                    if (eventManager?.isReady()) {
                        await eventManager.emit(eventName, data);
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.EVENT_EMISSION, ErrorSeverity.LOW);
                    // Re-queue event for retry if not too old
                    if (Date.now() - timestamp < 60000) {
                        this.#eventQueue.unshift({ eventName, data, timestamp });
                    }
                }
            }
        } finally {
            this.#isProcessingQueue = false;
        }
    }

    /**
     * Handle an error
     * @param {Error} error Error object
     * @param {string} type Error type
     * @param {string} severity Error severity
     * @param {Object} context Additional context
     */
    async handleError(error, type = ErrorType.UNKNOWN, severity = ErrorSeverity.MEDIUM, context = {}) {
        try {
            // Get error handler from registry
            const errorHandler = await this.#instanceRegistry?.get('error');
            if (errorHandler) {
                await errorHandler.handle(error, type, severity, {
                    manager: this.#name,
                    ...context
                });
            } else {
                console.error(`[${this.#name}] Error:`, error, {type, severity, context});
            }
        } catch (handlingError) {
            console.error('Error in error handler:', handlingError);
            console.error('Original error:', error);
        }
    }

    /**
     * Log a message
     * @param {string} level Log level
     * @param {string} message Message to log
     * @param {Object} data Additional data
     */
    async log(level, message, data = null) {
        try {
            // If we are LogManager, use direct console logging
            if (this.#name === 'log') {
                const timestamp = new Date().toISOString();
                console.log(`${timestamp} [${this.#name}] ${message}`, data || '');
                return;
            }

            // For other managers, try to use LogManager
            try {
                const logManager = await this.getDependency('log');
                if (logManager?.isInitialized()) {
                    await logManager.log(level, message, {
                        manager: this.#name,
                        ...data
                    });
                } else {
                    // Fallback to console if LogManager not ready
                    const timestamp = new Date().toISOString();
                    console.log(`${timestamp} [${this.#name}] ${message}`, data || '');
                }
            } catch (error) {
                // Fallback to console if getting LogManager fails
                const timestamp = new Date().toISOString();
                console.log(`${timestamp} [${this.#name}] ${message}`, data || '');
                console.error(`[${this.#name}] Logging error:`, error);
            }
        } catch (error) {
            // Last resort error logging
            console.error(`[${this.#name}] Critical logging error:`, error);
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
     * Emit an event with data
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    async emit(eventName, data = {}) {
        try {
            // Add event to queue instead of direct emission
            this.#eventQueue.push({
                eventName,
                data: {
                    ...data,
                    source: this.#name,
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            });
            
            // Process queue if not already processing
            if (!this.#isProcessingQueue) {
                await this.#processEventQueue();
            }
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_EMISSION, ErrorSeverity.LOW, {
                eventName,
                data
            });
        }
    }

    // Helper for legacy mode
    static createLegacy() {
        return new this(null);
    }
}

// Add PackingManager to dependency order
const DEPENDENCY_ORDER = [
    'error',
    'log',
    'event',
    'storage',
    'store',
    'cache',
    'api',
    'order',
    'data',
    'status',
    'language',
    'theme',
    'refresh',
    'alarm',
    'ui',
    'settings',
    'notification',
    'loading',
    'connection',
    'menu',
    'debug',
    'volume',
    'update',
    'user',
    'message',
    'progress',
    'interface',
    'counter',
    'usercard',
    'packing' // Add PackingManager
]; 