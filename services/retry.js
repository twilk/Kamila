export class RetryStrategy {
    constructor(maxAttempts = 3, delay = 1000) {
        this.maxAttempts = maxAttempts;
        this.delay = delay;
    }

    async execute(operation) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (!this.shouldRetry(error) || attempt === this.maxAttempts) {
                    throw error;
                }
                
                await this.wait(attempt);
            }
        }
        
        throw lastError;
    }

    shouldRetry(error) {
        // Retry na błędach 429 (rate limit) i 500-503 (błędy serwera)
        return error.status === 429 || 
               (error.status >= 500 && error.status <= 503);
    }

    wait(attempt) {
        // Exponential backoff
        const waitTime = this.delay * Math.pow(2, attempt - 1);
        return new Promise(resolve => setTimeout(resolve, waitTime));
    }
} 