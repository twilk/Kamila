import { logService } from './LogService.js';

export class RetryStrategy {
    constructor(maxAttempts = 3, delayMs = 1000) {
        this.maxAttempts = maxAttempts;
        this.delayMs = delayMs;
        this.attempts = 0;
        logService.debug('RetryStrategy constructed', { maxAttempts, delayMs });
    }

    async execute(operation) {
        while (this.attempts < this.maxAttempts) {
            try {
                logService.debug('Executing operation...', { attempt: this.attempts + 1 });
                const result = await operation();
                logService.debug('Operation executed successfully');
                return result;
            } catch (error) {
                this.attempts++;
                if (this.attempts === this.maxAttempts) {
                    logService.error('Retry strategy failed', { error, maxAttempts: this.maxAttempts });
                    throw error;
                }
                logService.warn('Operation failed, retrying...', { error, attempt: this.attempts });
                await new Promise(resolve => setTimeout(resolve, this.delayMs));
            }
        }
    }

    reset() {
        this.attempts = 0;
        logService.debug('RetryStrategy reset');
    }

    onError(error) {
        if (this.attempts >= this.maxAttempts) {
            logService.error('Retry strategy exhausted', { error, maxAttempts: this.maxAttempts });
            throw error;
        }

        logService.warn('Operation failed, scheduling retry', { error, nextAttempt: this.attempts + 1 });
        this.attempts++;
        return new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
}

export const retryService = new RetryStrategy(); 