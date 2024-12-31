import { logService } from '../services/LogService.js';
import { errorUtils } from './errorUtils.js';

export const retryUtils = {
    /**
     * Domyślne opcje dla retry
     */
    defaultOptions: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        shouldRetry: (error) => {
            return errorUtils.isNetworkError(error) || 
                   errorUtils.isTimeoutError(error);
        }
    },

    /**
     * Wykonuje funkcję z mechanizmem retry
     */
    async withRetry(fn, options = {}) {
        const config = { ...this.defaultOptions, ...options };
        let attempt = 1;
        let delay = config.initialDelay;

        while (attempt <= config.maxAttempts) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === config.maxAttempts || !config.shouldRetry(error)) {
                    throw error;
                }

                logService.warn(
                    `Attempt ${attempt} failed, retrying in ${delay}ms...`,
                    error
                );

                await this.sleep(delay);
                delay = Math.min(delay * config.backoffFactor, config.maxDelay);
                attempt++;
            }
        }
    },

    /**
     * Pomocnicza funkcja do sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Wykonuje funkcję z timeoutem
     */
    async withTimeout(fn, timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Operation timed out'));
            }, timeoutMs);
        });

        return Promise.race([fn(), timeoutPromise]);
    },

    /**
     * Wykonuje funkcję z retry i timeoutem
     */
    async withRetryAndTimeout(fn, timeoutMs, retryOptions = {}) {
        return this.withRetry(
            () => this.withTimeout(fn, timeoutMs),
            retryOptions
        );
    }
}; 