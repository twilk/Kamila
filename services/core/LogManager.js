import { BaseManager } from './BaseManager.js';
import { BaseLogger } from './BaseLogger.js';
import { LogLevel } from './LogLevel.js';

/**
 * Manager for application logging
 * @extends BaseManager
 */
export class LogManager extends BaseManager {
    /** @private */
    static #instance = null;

    /** @private */
    #logger = new BaseLogger();

    /** @private */
    #logHistory = [];

    /** @private */
    #MAX_LOG_HISTORY = 1000;

    constructor() {
        super('LogManager');
        if (LogManager.#instance) {
            return LogManager.#instance;
        }
        LogManager.#instance = this;
    }

    /**
     * Get singleton instance
     * @returns {LogManager} Singleton instance
     */
    static getInstance() {
        if (!LogManager.#instance) {
            LogManager.#instance = new LogManager();
        }
        return LogManager.#instance;
    }

    /**
     * Get logger instance
     * @returns {BaseLogger} Logger instance
     */
    getLogger() {
        return this.#logger;
    }

    /**
     * Log a message
     * @param {LogLevel} level - Log level
     * @param {string} message - Message to log
     * @param {Object} [context] - Additional context
     */
    log(level, message, context) {
        this.#logger.log(level, message, context);
        this.#addToHistory(level, message, context);
    }

    /**
     * Log an error
     * @param {string} message - Error message
     * @param {Error} error - Error object
     * @param {Object} [context] - Additional context
     */
    error(message, error, context) {
        this.log(LogLevel.ERROR, message, { error, ...context });
    }

    /**
     * Log a warning
     * @param {string} message - Warning message
     * @param {Object} [context] - Additional context
     */
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }

    /**
     * Log an info message
     * @param {string} message - Info message
     * @param {Object} [context] - Additional context
     */
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }

    /**
     * Log a debug message
     * @param {string} message - Debug message
     * @param {Object} [context] - Additional context
     */
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }

    /**
     * Log a success message
     * @param {string} message - Success message
     * @param {Object} [context] - Additional context
     */
    success(message, context) {
        this.log(LogLevel.SUCCESS, message, context);
    }

    /**
     * Add log entry to history
     * @private
     * @param {LogLevel} level - Log level
     * @param {string} message - Log message
     * @param {Object} [context] - Additional context
     */
    #addToHistory(level, message, context) {
        this.#logHistory.unshift({
            timestamp: new Date().toISOString(),
            level,
            message,
            context
        });

        if (this.#logHistory.length > this.#MAX_LOG_HISTORY) {
            this.#logHistory.pop();
        }
    }

    /**
     * Get log history
     * @returns {Array} Log history
     */
    getHistory() {
        return [...this.#logHistory];
    }

    /**
     * Clear log history
     */
    clearHistory() {
        this.#logHistory = [];
    }

    /**
     * Export logs to file
     * @returns {string} JSON string of logs
     */
    exportLogs() {
        return JSON.stringify(this.#logHistory, null, 2);
    }

    /**
     * Clean up resources
     * @returns {Promise<void>}
     */
    async dispose() {
        this.clearHistory();
        LogManager.#instance = null;
        await super.dispose();
    }
} 