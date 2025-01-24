import { ILogger } from './ILogger.js';
import { LogLevel } from './LogLevel.js';

/**
 * Base logger implementation
 * @implements {ILogger}
 */
export class BaseLogger extends ILogger {
    constructor() {
        super();
        this.LogLevel = LogLevel;
    }

    /**
     * Format a log message
     * @protected
     * @param {string} level - Log level
     * @param {string} message - Message to log
     * @param {Object} [context] - Additional context
     * @returns {string} Formatted log message
     */
    formatLog(level, message, context = {}) {
        const timestamp = this.getTimestamp();
        const emoji = this.getLogEmoji(level);
        return `[${timestamp}][${level}] ${emoji} ${message}${context ? ' ' + JSON.stringify(context) : ''}`;
    }

    /**
     * Get current timestamp in ISO format
     * @protected
     * @returns {string} Timestamp
     */
    getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Get emoji for log level
     * @protected
     * @param {string} level - Log level
     * @returns {string} Emoji for log level
     */
    getLogEmoji(level) {
        const emojis = {
            [LogLevel.ERROR]: '❌',
            [LogLevel.WARN]: '⚠️',
            [LogLevel.INFO]: 'ℹ️',
            [LogLevel.DEBUG]: '🔍',
            [LogLevel.SUCCESS]: '✅'
        };
        return emojis[level] || '';
    }

    /**
     * Log a message
     * @param {string} level - Log level
     * @param {string} message - Message to log
     * @param {Object} [context] - Additional context
     */
    log(level, message, context = {}) {
        console.log(this.formatLog(level, message, context));
    }

    /**
     * Log an error
     * @param {string} message - Error message
     * @param {Error} error - Error object
     * @param {Object} [context] - Additional context
     */
    error(message, error, context = {}) {
        this.log(this.LogLevel.ERROR, message, {
            ...context,
            error: error.message,
            stack: error.stack
        });
    }

    /**
     * Log a warning
     * @param {string} message - Warning message
     * @param {Object} [context] - Additional context
     */
    warn(message, context) {
        this.log(this.LogLevel.WARN, message, context);
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {Object} [context] - Additional context
     */
    info(message, context) {
        this.log(this.LogLevel.INFO, message, context);
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {Object} [context] - Additional context
     */
    debug(message, context) {
        this.log(this.LogLevel.DEBUG, message, context);
    }

    /**
     * Log success message
     * @param {string} message - Success message
     * @param {Object} [context] - Additional context
     */
    success(message, context) {
        this.log(this.LogLevel.SUCCESS, message, context);
    }
} 