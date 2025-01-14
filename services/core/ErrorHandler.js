import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

export class ErrorHandler extends BaseManager {
    static MAX_ERROR_HISTORY = 100;
    static ERROR_RETENTION_TIME = 3600000; // 1 hour

    constructor(metricsManager) {
        super();
        this.metricsManager = metricsManager;
        this.errorHistory = [];
        this.recoveryStrategies = new Map();
        this.errorSubscribers = new Set();
        this.lastCleanup = Date.now();
    }

    async onInitialize() {
        // Register default recovery strategies
        this.registerDefaultStrategies();
        
        // Start cleanup timer
        this.cleanupTimer = setInterval(() => this.cleanup(), 300000); // 5 minutes
        
        // Initial cleanup
        await this.cleanup();

            return true;
    }

    registerDefaultStrategies() {
        // Network errors
        this.registerRecoveryStrategy(ErrorType.NETWORK, async (error, context) => {
            const retryCount = context.retryCount || 0;
            if (retryCount < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                return {
                    shouldRetry: true,
                    context: { ...context, retryCount: retryCount + 1 }
                };
            }
            return { shouldRetry: false };
        });

        // Cache errors
        this.registerRecoveryStrategy(ErrorType.CACHE, async (error, context) => {
            await this.emit('cacheClear', { reason: 'error_recovery' });
            return { shouldRetry: true };
        });

        // Initialization errors
        this.registerRecoveryStrategy(ErrorType.INITIALIZATION, async (error, context) => {
            const manager = context.manager;
            if (manager && typeof manager.dispose === 'function') {
                await manager.dispose();
                return { shouldRetry: true };
            }
            return { shouldRetry: false };
        });
    }

    registerRecoveryStrategy(errorType, strategy) {
        this.recoveryStrategies.set(errorType, strategy);
    }

    async handleError(error, type = ErrorType.UNKNOWN, severity = ErrorSeverity.ERROR, context = {}) {
        try {
            // Create error record
            const errorRecord = {
                timestamp: Date.now(),
                error: error instanceof Error ? error : new Error(error),
                type,
                severity,
                context,
                handled: false,
                recovery: null
            };

            // Track in metrics
            this.metricsManager?.trackError(errorRecord);

            // Add to history
            this.errorHistory.unshift(errorRecord);

            // Try recovery if strategy exists
            const recoveryStrategy = this.recoveryStrategies.get(type);
            if (recoveryStrategy) {
                try {
                    const recovery = await recoveryStrategy(error, context);
                    errorRecord.recovery = recovery;
                    errorRecord.handled = recovery.shouldRetry;
                } catch (recoveryError) {
                    errorRecord.recovery = { error: recoveryError };
                }
            }

            // Notify subscribers
            this.notifySubscribers(errorRecord);

            // Log error
            this.logError(errorRecord);

            return errorRecord;
        } catch (handlerError) {
            console.error('Error in ErrorHandler:', handlerError);
            return {
                timestamp: Date.now(),
                error: handlerError,
                type: ErrorType.SYSTEM,
                severity: ErrorSeverity.CRITICAL,
                context: { originalError: error },
                handled: false
            };
        }
    }

    subscribe(callback) {
        this.errorSubscribers.add(callback);
        return () => this.errorSubscribers.delete(callback);
    }

    notifySubscribers(errorRecord) {
        this.errorSubscribers.forEach(subscriber => {
            try {
                subscriber(errorRecord);
            } catch (e) {
                console.error('Error in error subscriber:', e);
            }
        });
    }

    logError(errorRecord) {
        const { timestamp, error, type, severity, context, handled } = errorRecord;
        const logMessage = `[${new Date(timestamp).toISOString()}] ${severity}: ${error.message}`;
        
        switch (severity) {
            case ErrorSeverity.CRITICAL:
                console.error(logMessage, { type, context, error });
                break;
            case ErrorSeverity.ERROR:
                console.error(logMessage, { type, context });
                break;
            case ErrorSeverity.WARNING:
                console.warn(logMessage, { type, context });
                break;
            default:
                console.log(logMessage, { type, context });
        }

        if (handled) {
            console.info(`Error handled with recovery strategy for type: ${type}`);
        }
    }

    async cleanup() {
        const now = Date.now();
        
        // Remove old errors
        this.errorHistory = this.errorHistory.filter(record => 
            now - record.timestamp < ErrorHandler.ERROR_RETENTION_TIME
        );

        // Trim to max size
        if (this.errorHistory.length > ErrorHandler.MAX_ERROR_HISTORY) {
            this.errorHistory = this.errorHistory.slice(0, ErrorHandler.MAX_ERROR_HISTORY);
        }

        this.lastCleanup = now;
    }

    getErrorHistory(options = {}) {
        let filtered = [...this.errorHistory];

        if (options.type) {
            filtered = filtered.filter(record => record.type === options.type);
        }
        if (options.severity) {
            filtered = filtered.filter(record => record.severity === options.severity);
        }
        if (options.handled !== undefined) {
            filtered = filtered.filter(record => record.handled === options.handled);
        }
        if (options.since) {
            filtered = filtered.filter(record => record.timestamp >= options.since);
        }

        return filtered;
    }

    async dispose() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        this.errorHistory = [];
        this.recoveryStrategies.clear();
        this.errorSubscribers.clear();

        await super.dispose();
    }
} 