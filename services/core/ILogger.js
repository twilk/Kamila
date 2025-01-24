/**
 * @typedef {Object} LogLevel
 * @property {string} ERROR - Error level logging
 * @property {string} WARN - Warning level logging
 * @property {string} INFO - Info level logging
 * @property {string} DEBUG - Debug level logging
 * @property {string} SUCCESS - Success level logging
 */

/**
 * Interface for logger implementations
 * @interface
 */
export class ILogger {
    /**
     * Log a message with specified level
     * @param {LogLevel} level - Log level
     * @param {string} message - Message to log
     * @param {Object} [context] - Additional context
     */
    log(level, message, context) {
        throw new Error('Method not implemented');
    }

    /**
     * Log an error
     * @param {string} message - Error message
     * @param {Error} error - Error object
     * @param {Object} [context] - Additional context
     */
    error(message, error, context) {
        throw new Error('Method not implemented');
    }

    /**
     * Log a warning
     * @param {string} message - Warning message
     * @param {Object} [context] - Additional context
     */
    warn(message, context) {
        throw new Error('Method not implemented');
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {Object} [context] - Additional context
     */
    info(message, context) {
        throw new Error('Method not implemented');
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {Object} [context] - Additional context
     */
    debug(message, context) {
        throw new Error('Method not implemented');
    }

    /**
     * Log success message
     * @param {string} message - Success message
     * @param {Object} [context] - Additional context
     */
    success(message, context) {
        throw new Error('Method not implemented');
    }
} 