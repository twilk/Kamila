/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
    /**
     * @type {string}
     */
    managerName;

    /**
     * @type {number}
     */
    timeout;

    /**
     * @type {number}
     */
    attempt;

    /**
     * Create a new timeout error
     * @param {string} message Error message
     * @param {string} managerName Name of the manager that timed out
     * @param {number} timeout Timeout duration in milliseconds
     * @param {number} attempt Current attempt number
     */
    constructor(message, managerName, timeout, attempt = 1) {
        super(message);
        this.name = 'TimeoutError';
        this.managerName = managerName;
        this.timeout = timeout;
        this.attempt = attempt;
    }

    /**
     * Get a formatted error message
     * @returns {string}
     */
    getFormattedMessage() {
        return `Timeout after ${this.timeout}ms while initializing ${this.managerName} (attempt ${this.attempt})`;
    }

    /**
     * Convert error to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            managerName: this.managerName,
            timeout: this.timeout,
            attempt: this.attempt,
            stack: this.stack
        };
    }
} 