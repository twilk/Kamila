import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { BaseManager } from './BaseManager.js';

/**
 * Core error handling functionality
 */
class ErrorHandlerCore {
    #errors = [];
    #maxErrors = 100;
    #name = 'ErrorHandler';
    
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
    handle(error, type = ErrorType.RUNTIME, severity = ErrorSeverity.HIGH, context = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            type,
            severity,
            message: error.message,
            stack: error.stack,
            context: {
                ...context,
                url: window.location.href,
                userAgent: navigator.userAgent
            }
        };

        // Log error with appropriate level based on severity
        const logLevel = severity === ErrorSeverity.HIGH ? LogLevel.ERROR :
                        severity === ErrorSeverity.MEDIUM ? LogLevel.WARN :
                        LogLevel.INFO;

        this.log(logLevel, `[${type}] ${errorInfo.message}`, {
            error,
            context: errorInfo.context,
            severity
        });
        
        // Store error
        this.#errors.unshift(errorInfo);
        
        // Trim errors array if needed
        if (this.#errors.length > this.#maxErrors) {
            this.#errors = this.#errors.slice(0, this.#maxErrors);
        }
        
        // Store in chrome.storage for persistence
        chrome.storage.local.set({
            errors: this.#errors
        }).catch(storageError => {
            console.error('Failed to store error:', storageError);
        });
        
        // Emit error event with type and severity
        const errorEvent = new CustomEvent('app:error', {
            detail: errorInfo
        });
        window.dispatchEvent(errorEvent);
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
    handleGlobalError(message, source, lineno, colno, error) {
        this.handle(
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
    handleUnhandledRejection(event) {
        this.handle(
            event.reason,
            ErrorType.RUNTIME,
            ErrorSeverity.HIGH,
            { source: 'unhandledrejection' }
        );
    }
}

/**
 * Error handler manager that integrates with the manager system
 */
export class ErrorHandler extends BaseManager {
    static #instance = null;
    #core;
    
    constructor() {
        super('ErrorHandler');
        if (ErrorHandler.#instance) {
            return ErrorHandler.#instance;
        }
        ErrorHandler.#instance = this;
        this.#core = new ErrorHandlerCore();
    }
    
    /**
     * Get singleton instance
     * @returns {ErrorHandler}
     */
    static getInstance() {
        if (!ErrorHandler.#instance) {
            ErrorHandler.#instance = new ErrorHandler();
        }
        return ErrorHandler.#instance;
    }

    /**
     * Initialize error handler
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing error handler...');
            // Initialize error storage and listeners
            window.onerror = this.#core.handleGlobalError.bind(this.#core);
            window.onunhandledrejection = this.#core.handleUnhandledRejection.bind(this.#core);
            
            this.log(LogLevel.SUCCESS, '✅ Initialized successfully');
            return true;
        } catch (error) {
            console.error('[ErrorHandler] Failed to initialize:', error);
            return false;
        }
    }

    // Delegate core error handling methods
    handle(...args) { return this.#core.handle(...args); }
    getErrors() { return this.#core.getErrors(); }
    clearErrors() { return this.#core.clearErrors(); }
    log(...args) { return this.#core.log(...args); }

    /**
     * Dispose error handler
     */
    async dispose() {
        try {
            this.log(LogLevel.INFO, '🔄 Disposing error handler...');
            
            // Remove event listeners
            window.onerror = null;
            window.onunhandledrejection = null;
            
            // Clear errors
            this.#core.clearErrors();
            
            await super.dispose();
            this.log(LogLevel.SUCCESS, '✅ Disposed successfully');
        } catch (error) {
            console.error('[ErrorHandler] Failed to dispose:', error);
        }
    }
}

export const errorHandler = ErrorHandler.getInstance(); 