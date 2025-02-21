import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { BaseManager } from './BaseManager.js';

/**
 * Core error handling functionality
 */
class ErrorHandlerCore {
    #errors = [];
    #maxErrors = 100;
    #name = 'ErrorHandler';
    #eventQueue = [];
    #isEventManagerReady = false;
    #isInitialized = false;
    #registry = null;
    #handleGlobalError = null;
    #handleUnhandledRejection = null;
    
    constructor(registry) {
        if (!registry) {
            throw new Error('Registry is required');
        }
        this.#registry = registry;
        
        // Bind handlers
        this.#handleGlobalError = this.handleGlobalError.bind(this);
        this.#handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
        
        // Set up error listeners immediately
        this.setupErrorListeners();
    }

    setupErrorListeners() {
        // Remove existing listeners if any
        window.removeEventListener('error', this.#handleGlobalError);
        window.removeEventListener('unhandledrejection', this.#handleUnhandledRejection);
        
        // Add listeners
        window.addEventListener('error', this.#handleGlobalError);
        window.addEventListener('unhandledrejection', this.#handleUnhandledRejection);
    }

    /**
     * Log a message with the specified level
     * @param {LogLevel} level Log level
     * @param {string} message Message to log
     * @param {Object} [data] Additional data to log
     */
    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const prefix = `[${this.#name}]`;
        
        let logFn;
        switch (level) {
            case LogLevel.ERROR:
                logFn = console.error;
                break;
            case LogLevel.WARN:
                logFn = console.warn;
                break;
            case LogLevel.INFO:
                logFn = console.info;
                break;
            case LogLevel.DEBUG:
                logFn = console.debug;
                break;
            case LogLevel.SUCCESS:
                logFn = console.info;
                break;
            default:
                logFn = console.log;
        }
        
        if (Object.keys(data).length > 0) {
            logFn(`${timestamp} ${prefix} ${message}`, data);
        } else {
            logFn(`${timestamp} ${prefix} ${message}`);
        }
    }

    /**
     * Handle an error
     * @param {Error} error Error object
     * @param {ErrorType} type Error type
     * @param {ErrorSeverity} severity Error severity
     * @param {Object} [context] Additional context
     */
    async handle(error, type = ErrorType.UNKNOWN, severity = ErrorSeverity.MEDIUM, context = {}) {
        try {
            // Log error immediately
            this.log(LogLevel.ERROR, error.message, {
                type,
                severity,
                context,
                stack: error.stack
            });

            // Store error
            const errorData = {
                message: error.message,
                type,
                severity,
                context,
                timestamp: new Date().toISOString()
            };
            
            this.#errors.push(errorData);
            if (this.#errors.length > this.#maxErrors) {
                this.#errors.shift();
            }

            // Try to emit if EventManager is ready
            try {
                const eventManager = await this.#registry?.get('event');
                if (eventManager?.isInitialized()) {
                    await eventManager.emit('app:error', errorData);
                } else {
                    this.#eventQueue.push({
                        event: 'app:error',
                        data: errorData
                    });
                }
            } catch {
                // Silently queue if EventManager not available
                this.#eventQueue.push({
                    event: 'app:error',
                    data: errorData
                });
            }

            // Handle based on severity
            if (severity === ErrorSeverity.HIGH) {
                await this.#handleHighSeverityError(error, type, context);
            }
        } catch (handlingError) {
            console.error('Error in error handler:', handlingError);
            console.error('Original error:', error);
        }
    }
    
    /**
     * Get all stored errors
     * @returns {Array} Array of errors
     */
    getErrors() {
        return [...this.#errors];
    }
    
    /**
     * Clear all stored errors
     */
    clearErrors() {
        this.#errors = [];
        chrome.storage.local.remove('errors');
    }

    /**
     * Handle global error
     * @param {string} message Error message
     * @param {string} source Source of error
     * @param {number} lineno Line number
     * @param {number} colno Column number
     * @param {Error} error Error object
     */
    async handleGlobalError(message, source, lineno, colno, error) {
        return this.handle(
            error || new Error(message),
            ErrorType.RUNTIME,
            ErrorSeverity.HIGH,
            { source, lineno, colno }
        );
    }

    /**
     * Handle unhandled promise rejection
     * @param {PromiseRejectionEvent} event Rejection event
     */
    async handleUnhandledRejection(event) {
        return this.handle(
            event.reason,
            ErrorType.RUNTIME,
            ErrorSeverity.HIGH,
            { source: 'unhandledrejection' }
        );
    }

    #handleHighSeverityError(error, type, context) {
        // Implementation of handling high severity error
    }

    /**
     * Process queued events when EventManager becomes ready
     */
    async processEventQueue() {
        if (this.#eventQueue.length === 0) return;

        try {
            const eventManager = await this.#registry.get('event');
            if (!eventManager?.isInitialized()) return;

            this.#isEventManagerReady = true;
            
            while (this.#eventQueue.length > 0) {
                const { event, data } = this.#eventQueue.shift();
                await eventManager.emit(event, data);
            }
        } catch (error) {
            console.error('Failed to process event queue:', error);
        }
    }

    getHandlers() {
        return {
            globalError: this.#handleGlobalError,
            unhandledRejection: this.#handleUnhandledRejection
        };
    }
}

/**
 * Error handler manager that integrates with the manager system
 */
class ErrorHandler extends BaseManager {
    static #instance = null;
    #core = null;
    
    constructor(registry = null) {
        if (ErrorHandler.#instance) {
            return ErrorHandler.#instance;
        }
        super(registry, 'error');
        ErrorHandler.#instance = this;
        
        // Create core only on first instantiation
        this.#core = new ErrorHandlerCore(registry);
    }

    static getInstance() {
        if (!ErrorHandler.#instance) {
            throw new Error('ErrorHandler not initialized');
        }
        return ErrorHandler.#instance;
    }

    static createInstance(registry) {
        if (!registry) {
            throw new Error('Registry is required');
        }
        if (!ErrorHandler.#instance) {
            ErrorHandler.#instance = new ErrorHandler(registry);
        }
        return ErrorHandler.#instance;
    }

    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing error handler...');
            
            // Process any queued events
            await this.#core.processEventQueue();
            
            this.log(LogLevel.SUCCESS, '✅ Error handler initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize error handler:', error);
            return false;
        }
    }

    // Delegate methods to core
    async handle(...args) { return this.#core.handle(...args); }
    getErrors() { return this.#core.getErrors(); }
    clearErrors() { return this.#core.clearErrors(); }
    log(...args) { return this.#core.log(...args); }
    processEventQueue() { return this.#core.processEventQueue(); }

    async dispose() {
        try {
            const handlers = this.#core.getHandlers();
            // Clean up event listeners
            window.removeEventListener('error', handlers.globalError);
            window.removeEventListener('unhandledrejection', handlers.unhandledRejection);
            
            this.#core = null;
            ErrorHandler.#instance = null;
            
            await super.dispose();
        } catch (error) {
            console.error('Error disposing error handler:', error);
        }
    }

    _setupGlobalHandlers() {
        window.onerror = (msg, url, line, col, error) => {
            this.handle(error || new Error(msg));
            return true;
        };
        
        window.onunhandledrejection = (event) => {
            this.handle(event.reason);
            return true;
        };
    }
}

// Export only createInstance
export { ErrorHandler };
export const createErrorHandler = ErrorHandler.createInstance; 