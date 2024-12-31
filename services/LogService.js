/**
 * Service for centralized logging functionality
 */
class LogService {
    constructor() {
        this.debugMode = false;
        this.logLevel = 'info';
        this.logLevels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.log('debug', 'Debug mode set to:', enabled);
    }

    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.logLevel = level;
            this.log('info', 'Log level set to:', level);
        }
    }

    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            this.log('debug', message, ...args);
        }
    }

    info(message, ...args) {
        if (this.shouldLog('info')) {
            this.log('info', message, ...args);
        }
    }

    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            this.log('warn', message, ...args);
        }
    }

    error(message, ...args) {
        if (this.shouldLog('error')) {
            this.log('error', message, ...args);
        }
    }

    shouldLog(level) {
        return this.logLevels[level] >= this.logLevels[this.logLevel];
    }

    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        if (args.length > 0) {
            if (typeof args[0] === 'object' && args[0] !== null) {
                // If first argument is an object (context data), format it nicely
                console[level](prefix, message, JSON.stringify(args[0], null, 2), ...args.slice(1));
            } else {
                console[level](prefix, message, ...args);
            }
        } else {
            console[level](prefix, message);
        }

        // Add to debug panel if it exists
        this.addToDebugPanel(level, message, args);
    }

    addToDebugPanel(level, message, args) {
        const debugPanel = document.getElementById('debug-panel');
        if (!debugPanel) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        
        let logMessage = message;
        if (args.length > 0) {
            if (typeof args[0] === 'object' && args[0] !== null) {
                logMessage += ' ' + JSON.stringify(args[0]);
            } else {
                logMessage += ' ' + args.join(' ');
            }
        }

        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${logMessage}`;
        debugPanel.appendChild(logEntry);
        debugPanel.scrollTop = debugPanel.scrollHeight;
    }
}

// Create and export singleton instance
export const logService = new LogService(); 