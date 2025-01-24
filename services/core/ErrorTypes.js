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
    UI: 'ui',
    API: 'api',
    DISPOSAL: 'disposal',
    GENERAL: 'general',
    UNKNOWN: 'unknown'
};

/**
 * Poziomy błędów
 */
export const ErrorSeverity = {
    LOW: 'low',           // Informational, non-critical
    MEDIUM: 'medium',     // Warning, may need attention
    HIGH: 'high',         // Error, requires attention
    CRITICAL: 'critical'  // System failure, immediate action needed
};

/**
 * Strategie odzyskiwania po błędach
 */
export const ErrorRecoveryStrategy = {
    RETRY: 'retry',           // Retry the operation
    FALLBACK: 'fallback',     // Use fallback value/behavior
    RESET: 'reset',           // Reset to initial state
    IGNORE: 'ignore',         // Continue without recovery
    NOTIFY: 'notify'          // Notify user and continue
};

/**
 * Klasa reprezentująca błąd aplikacji
 */
export class AppError extends Error {
    constructor(message, type = ErrorType.UNKNOWN, severity = ErrorSeverity.HIGH, context = {}) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.severity = severity;
        this.context = context;
        this.timestamp = Date.now();
        this.recoveryAttempts = 0;
        this.recoveryStrategy = null;
    }

    /**
     * Konwertuje błąd do formatu JSON
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack,
            recoveryAttempts: this.recoveryAttempts,
            recoveryStrategy: this.recoveryStrategy
        };
    }
}