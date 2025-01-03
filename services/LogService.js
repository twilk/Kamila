/**
 * Serwis do logowania zdarzeń w aplikacji
 */
class LogService {
    constructor() {
        this.listeners = new Set();
        this.logLevel = 'info'; // Default to info level
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        this.debug('LogService constructed');
    }

    setLogLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.logLevel = level;
            this.info(`Log level set to: ${level}`);
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(logEntry) {
        if (!this.shouldLog(logEntry.level)) return;
        
        this.listeners.forEach(listener => {
            try {
                listener(logEntry);
            } catch (error) {
                console.error('Error in log listener:', error);
            }
        });
    }

    log(level, message, data) {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        // Format log message
        const logMessage = data 
            ? `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(data, null, 2)}`
            : `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        // Output to console with appropriate styling
        switch (level) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'info':
                console.log(logMessage);
                break;
            case 'debug':
                console.log(logMessage);
                break;
            default:
                console.log(logMessage);
        }

        // Notify listeners
        this.notifyListeners(logEntry);
    }

    error(message, data) {
        this.log('error', message, data);
    }

    warn(message, data) {
        this.log('warn', message, data);
    }

    info(message, data) {
        this.log('info', message, data);
    }

    debug(message, data) {
        this.log('debug', message, data);
    }

    getLogLevel() {
        return this.logLevel;
    }
}

// Create and export singleton instance
const logService = new LogService();
export { logService }; 