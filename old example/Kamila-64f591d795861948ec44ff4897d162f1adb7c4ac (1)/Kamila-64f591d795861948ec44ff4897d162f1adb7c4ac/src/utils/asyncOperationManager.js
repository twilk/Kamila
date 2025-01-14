export class AsyncOperationManager {
    constructor(defaultTimeout = 30000, maxRetries = 3) {
        this.defaultTimeout = defaultTimeout;
        this.maxRetries = maxRetries;
    }

    async executeWithTimeout(operation, timeout = this.defaultTimeout) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timed out')), timeout);
        });

        return Promise.race([operation(), timeoutPromise]);
    }

    async executeWithRetry(operation, options = {}) {
        const {
            timeout = this.defaultTimeout,
            maxRetries = this.maxRetries,
            retryDelay = 1000,
            onRetry = null
        } = options;

        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.executeWithTimeout(operation, timeout);
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    if (onRetry) {
                        onRetry(error, attempt);
                    }
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        }
        throw lastError;
    }

    async executeWithProgressiveLoading(operation, options = {}) {
        const {
            batchSize = 50,
            onProgress = null,
            timeout = this.defaultTimeout,
            maxRetries = this.maxRetries
        } = options;

        let offset = 0;
        let hasMore = true;
        const results = [];

        while (hasMore) {
            try {
                const batch = await this.executeWithRetry(
                    async () => operation(offset, batchSize),
                    { timeout, maxRetries }
                );

                if (batch && batch.length > 0) {
                    results.push(...batch);
                    offset += batch.length;
                    if (onProgress) {
                        onProgress(results.length, batch);
                    }
                    hasMore = batch.length === batchSize;
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error('Error during progressive loading:', error);
                throw error;
            }
        }

        return results;
    }

    createAbortableOperation(operation) {
        const controller = new AbortController();
        const promise = operation(controller.signal);
        return {
            promise,
            abort: () => controller.abort()
        };
    }
} 