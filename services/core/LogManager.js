import { BaseManager } from './BaseManager.js';
import { LogLevel, ErrorType, ErrorSeverity } from '../constants.js';

const LOG_CONFIG = {
    MAX_LOGS: 10000,
    BATCH_SIZE: 100,
    FLUSH_INTERVAL: 5000,
    MAX_MESSAGE_LENGTH: 1000,
    RETENTION_PERIOD: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Manager for application logging
 * @extends BaseManager
 */
class LogManager extends BaseManager {
    static #instance = null;
    static _registry = null;

    /** @private */
    #logs = [];

    /** @private */
    #flushInterval = null;

    /** @private */
    #pendingBatch = [];

    /** @private */
    #processing = false;

    /** @private */
    #storageKey = 'app_logs';

    /** @private */
    #config = {
        ...LOG_CONFIG,
        minLevel: LogLevel.INFO
    };

    constructor(registry) {
        if (LogManager.#instance) {
            return LogManager.#instance;
        }
        super(registry, 'LogManager');
        LogManager.#instance = this;
        LogManager._registry = registry;
        
        // Add dependencies
        this.addDependency('error');
    }

    static getInstance() {
        if (!LogManager.#instance && LogManager._registry) {
            LogManager.#instance = new LogManager(LogManager._registry);
        }
        return LogManager.#instance;
    }

    static setRegistry(registry) {
        LogManager._registry = registry;
    }

    /**
     * Initialize the log manager
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing log manager...');
            
            // Load logs from storage
            const logs = await chrome.storage.local.get('logs');
            this.#logs = logs?.logs || [];
            
            // Start flush interval
            this.#flushInterval = setInterval(() => this.#saveLogs(), 5 * 60 * 1000); // 5 minutes
            
            this.log(LogLevel.SUCCESS, '✅ Log manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize log manager:', error);
            return false;
        }
    }

    /**
     * Log a message
     * @param {LogLevel} level Log level
     * @param {string} message Message
     * @param {Object} [data] Additional data
     */
    async log(level, message, data = null) {
        try {
            // Skip if level is below minimum
            if (level < this.#config.minLevel) {
                return;
            }

            // Truncate message if too long
            if (message.length > this.#config.MAX_MESSAGE_LENGTH) {
                message = message.substring(0, this.#config.MAX_MESSAGE_LENGTH) + '...';
            }

            const logEntry = {
                timestamp: Date.now(),
                level,
                message,
                data
            };

            // Add to pending batch
            this.#pendingBatch.push(logEntry);

            // Process batch if full
            if (this.#pendingBatch.length >= this.#config.BATCH_SIZE) {
                await this.#processBatch();
            }

            // Output to console
            this.#outputToConsole(logEntry);
        } catch (error) {
            this.#handleError(error, ErrorType.LOGGING, ErrorSeverity.LOW);
        }
    }

    /**
     * Process pending batch
     * @private
     */
    async #processBatch() {
        if (this.#processing || this.#pendingBatch.length === 0) return;

        this.#processing = true;
        
        try {
            const batch = this.#pendingBatch.splice(0, this.#config.BATCH_SIZE);
            
            // Add to logs array
            this.#logs.push(...batch);
            
            // Trim old logs
            this.#trimLogs();
            
            // Save to storage
            await this.#saveLogs();
        } catch (error) {
            this.#handleError(error, ErrorType.LOG_PROCESSING, ErrorSeverity.MEDIUM);
        } finally {
            this.#processing = false;
        }
    }

    /**
     * Save logs to storage
     * @private
     */
    async #saveLogs() {
        try {
            await chrome.storage.local.set({ logs: this.#logs });
        } catch (error) {
            console.error('Failed to save logs:', error);
        }
    }

    /**
     * Start flush interval
     * @private
     */
    #startFlushInterval() {
        if (this.#flushInterval) {
            clearInterval(this.#flushInterval);
        }

        this.#flushInterval = setInterval(
            () => this.#flushLogs(),
            this.#config.FLUSH_INTERVAL
        );
    }

    /**
     * Flush pending logs
     * @private
     */
    async #flushLogs() {
        if (this.#pendingBatch.length > 0) {
            await this.#processBatch();
        }
    }

    /**
     * Trim old logs
     * @private
     */
    #trimLogs() {
        // Remove logs over max size
        if (this.#logs.length > this.#config.MAX_LOGS) {
            this.#logs = this.#logs.slice(-this.#config.MAX_LOGS);
        }

        // Remove old logs
        const cutoff = Date.now() - this.#config.RETENTION_PERIOD;
        this.#logs = this.#logs.filter(log => log.timestamp >= cutoff);
    }

    /**
     * Output log entry to console
     * @private
     */
    #outputToConsole(logEntry) {
        const { level, message, data } = logEntry;
        const timestamp = new Date(logEntry.timestamp).toISOString();
        
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

        if (data) {
            logFn(`${timestamp} ${message}`, data);
        } else {
            logFn(`${timestamp} ${message}`);
        }
    }

    /**
     * Handle error without causing recursion
     * @private
     */
    #handleError(error, type, severity) {
        try {
            this.getDependency('error')
                .then(handler => handler.handle(error, type, severity))
                .catch(err => console.error('Failed to handle error:', err));
        } catch (handlingError) {
            console.error('Error in error handler:', handlingError);
            console.error('Original error:', error);
        }
    }

    /**
     * Get logs with optional filtering
     * @param {Object} options Filter options
     * @param {LogLevel} [options.level] Filter by log level
     * @param {number} [options.since] Filter by timestamp
     * @param {number} [options.limit] Limit number of logs
     * @returns {Array} Filtered logs
     */
    getLogs(options = {}) {
        let filtered = [...this.#logs];

        if (options.level) {
            filtered = filtered.filter(log => log.level === options.level);
        }

        if (options.since) {
            filtered = filtered.filter(log => log.timestamp >= options.since);
        }

        if (options.limit) {
            filtered = filtered.slice(-options.limit);
        }

        return filtered;
    }

    /**
     * Clear all logs
     */
    async clearLogs() {
        this.#logs = [];
        this.#pendingBatch = [];
        
        try {
            await chrome.storage.local.remove(this.#storageKey);
        } catch (error) {
            this.#handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW);
        }
    }

    /**
     * Get log stats
     * @returns {Object} Log statistics
     */
    getStats() {
        const levels = {};
        for (const log of this.#logs) {
            levels[log.level] = (levels[log.level] || 0) + 1;
        }

        return {
            totalLogs: this.#logs.length,
            pendingLogs: this.#pendingBatch.length,
            isProcessing: this.#processing,
            levelCounts: levels,
            oldestLog: this.#logs[0]?.timestamp,
            newestLog: this.#logs[this.#logs.length - 1]?.timestamp
        };
    }

    /**
     * Set minimum log level
     * @param {LogLevel} level Minimum log level
     */
    setMinLevel(level) {
        this.#config.minLevel = level;
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        if (this.#flushInterval) {
            clearInterval(this.#flushInterval);
            this.#flushInterval = null;
        }

        // Flush any pending logs
        await this.#flushLogs();

        this.#logs = [];
        this.#pendingBatch = [];
        this.#processing = false;
    }
}

// Export class only
export { LogManager }; 