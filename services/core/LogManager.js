import { BaseLogger } from './BaseLogger.js';

/**
 * Manager for application logging
 */
export class LogManager {
    constructor() {
        if (LogManager.instance) {
            return LogManager.instance;
        }
        LogManager.instance = this;
        
        this._logger = new BaseLogger();
        this._logHistory = [];
        this.MAX_LOG_HISTORY = 1000;
    }

    /**
     * Get singleton instance
     * @returns {LogManager} Singleton instance
     */
    static getInstance() {
        if (!LogManager.instance) {
            LogManager.instance = new LogManager();
        }
        return LogManager.instance;
    }

    /**
     * Get logger instance
     * @returns {BaseLogger} Logger instance
     */
    getLogger() {
        return this._logger;
    }

    /**
     * Log a message
     * @param {string} level - Log level
     * @param {string} message - Message to log
     * @param {Object} [context] - Additional context
     */
    log(level, message, context) {
        this._logger.log(level, message, context);
        this._addToHistory(level, message, context);
    }

    /**
     * Log an error
     * @param {string} message - Error message
     * @param {Error} error - Error object
     * @param {Object} [context] - Additional context
     */
    error(message, error, context) {
        this._logger.error(message, error, context);
        this._addToHistory('ERROR', message, { ...context, error: error.message, stack: error.stack });
    }

    /**
     * Log a warning
     * @param {string} message - Warning message
     * @param {Object} [context] - Additional context
     */
    warn(message, context) {
        this._logger.warn(message, context);
        this._addToHistory('WARN', message, context);
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {Object} [context] - Additional context
     */
    info(message, context) {
        this._logger.info(message, context);
        this._addToHistory('INFO', message, context);
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {Object} [context] - Additional context
     */
    debug(message, context) {
        this._logger.debug(message, context);
        this._addToHistory('DEBUG', message, context);
    }

    /**
     * Log success message
     * @param {string} message - Success message
     * @param {Object} [context] - Additional context
     */
    success(message, context) {
        this._logger.success(message, context);
        this._addToHistory('SUCCESS', message, context);
    }

    /**
     * Add log entry to history
     * @private
     * @param {string} level - Log level
     * @param {string} message - Message to log
     * @param {Object} [context] - Additional context
     */
    _addToHistory(level, message, context) {
        this._logHistory.unshift({
            timestamp: new Date().toISOString(),
            level,
            message,
            context
        });

        if (this._logHistory.length > this.MAX_LOG_HISTORY) {
            this._logHistory = this._logHistory.slice(0, this.MAX_LOG_HISTORY);
        }
    }

    /**
     * Get log history
     * @returns {Array} Log history
     */
    getHistory() {
        return [...this._logHistory];
    }

    /**
     * Clear log history
     */
    clearHistory() {
        this._logHistory = [];
    }

    /**
     * Export logs to JSON
     * @returns {string} JSON string of logs
     */
    exportLogs() {
        return JSON.stringify(this._logHistory, null, 2);
    }
} 