/**
 * Typy błędów
 */
export const ErrorType = {
    NETWORK: 'network',
    CACHE: 'cache',
    EVENT: 'event',
    INITIALIZATION: 'initialization',
    STORAGE: 'storage',
    VALIDATION: 'validation',
    UNKNOWN: 'unknown'
};

/**
 * Poziomy błędów
 */
export const ErrorSeverity = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

export const ErrorRecoveryStrategy = {
    RETRY: 'retry',
    FALLBACK: 'fallback',
    RESET: 'reset',
    IGNORE: 'ignore'
};

export class AppError extends Error {
    constructor(message, type = ErrorType.UNKNOWN, severity = ErrorSeverity.ERROR, context = {}) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.severity = severity;
        this.context = context;
        this.timestamp = Date.now();
        this.recoveryAttempts = 0;
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack,
            recoveryAttempts: this.recoveryAttempts
        };
    }
} 