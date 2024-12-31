import { logService } from './LogService.js';
import { loadingService } from './LoadingService.js';

const DEFAULT_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    maxConcurrent: 4
};

/**
 * Service for managing request queues with retries and rate limiting
 */
export class RequestQueueService {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.initialized = false;
        this.activeRequests = 0;
        this.config = { ...DEFAULT_CONFIG };
        this.observers = new Set();
        logService.info('RequestQueueService constructed');
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('RequestQueueService already initialized');
            return;
        }

        try {
            logService.info('Initializing RequestQueueService...');
            
            // Setup request interceptors
            this.setupInterceptors();
            
            this.initialized = true;
            logService.info('RequestQueueService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize RequestQueueService', error);
            throw error;
        }
    }

    setupInterceptors() {
        // Add default response interceptor for error handling
        this.addResponseInterceptor(async (response) => {
            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`);
                error.response = response;
                throw error;
            }
            return response;
        });

        logService.debug('Request interceptors setup complete');
    }

    configure(config) {
        this.config = {
            ...this.config,
            ...config
        };
        logService.debug('RequestQueueService configuration updated', this.config);
    }

    async enqueue(request) {
        if (!this.initialized) {
            throw new Error('Cannot enqueue requests before initialization');
        }

        try {
            const requestId = this.generateRequestId();
            logService.debug('Enqueueing request', { requestId, url: request.url });

            const promise = new Promise((resolve, reject) => {
                this.queue.push({
                    id: requestId,
                    request: this.prepareRequest(request),
                    resolve,
                    reject,
                    retries: 0,
                    timestamp: Date.now()
                });
            });

            // Start processing if not already processing
            if (!this.processing) {
                this.processQueue();
            }

            return promise;
        } catch (error) {
            logService.error('Failed to enqueue request', error);
            throw error;
        }
    }

    prepareRequest(request) {
        return {
            ...request,
            headers: {
                ...request.headers,
                'X-Request-ID': this.generateRequestId()
            },
            timeout: request.timeout || this.config.timeout
        };
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        loadingService.setLoading('api', true);

        try {
            while (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrent) {
                const batch = this.queue.splice(0, this.config.maxConcurrent - this.activeRequests);
                const promises = batch.map(item => this.processRequest(item));
                
                // Process batch in parallel
                await Promise.allSettled(promises);
            }
        } catch (error) {
            logService.error('Error processing request queue', error);
        } finally {
            this.processing = false;
            loadingService.setLoading('api', false);
            
            // If there are still items in the queue, continue processing
            if (this.queue.length > 0) {
                this.processQueue();
            }
        }
    }

    async processRequest(item) {
        this.activeRequests++;
        const startTime = Date.now();

        try {
            logService.debug('Processing request', { 
                id: item.id, 
                url: item.request.url,
                attempt: item.retries + 1 
            });

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), item.request.timeout);

            const response = await fetch(item.request.url, {
                ...item.request,
                signal: controller.signal
            });

            clearTimeout(timeout);

            // Run through response interceptors
            const processedResponse = await this.runResponseInterceptors(response);
            const data = await processedResponse.json();

            const duration = Date.now() - startTime;
            logService.debug('Request completed', { 
                id: item.id,
                duration,
                status: response.status 
            });

            item.resolve(data);
        } catch (error) {
            if (error.name === 'AbortError') {
                logService.warn('Request timed out', { id: item.id });
                item.reject(new Error('Request timed out'));
            } else if (item.retries < this.config.maxRetries) {
                item.retries++;
                const delay = this.config.retryDelay * Math.pow(2, item.retries - 1);
                
                logService.warn('Request failed, retrying', {
                    id: item.id,
                    attempt: item.retries,
                    delay
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                this.queue.unshift(item);
            } else {
                logService.error('Request failed permanently', {
                    id: item.id,
                    error: error.message
                });
                item.reject(error);
            }
        } finally {
            this.activeRequests--;
        }
    }

    addResponseInterceptor(interceptor) {
        this.observers.add(interceptor);
    }

    removeResponseInterceptor(interceptor) {
        this.observers.delete(interceptor);
    }

    async runResponseInterceptors(response) {
        let result = response;
        for (const interceptor of this.observers) {
            try {
                result = await interceptor(result);
            } catch (error) {
                logService.error('Error in response interceptor', error);
                throw error;
            }
        }
        return result;
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getQueueStats() {
        return {
            queueLength: this.queue.length,
            activeRequests: this.activeRequests,
            isProcessing: this.processing
        };
    }

    clearQueue() {
        if (!this.initialized) {
            logService.warn('Attempting to clear queue before initialization');
            return;
        }

        try {
            logService.debug('Clearing request queue...');
            this.queue.forEach(item => {
                item.reject(new Error('Queue cleared'));
            });
            this.queue = [];
            logService.debug('Request queue cleared successfully');
        } catch (error) {
            logService.error('Error clearing request queue', error);
            throw error;
        }
    }

    cleanup() {
        if (!this.initialized) return;

        try {
            logService.debug('Cleaning up RequestQueueService...');
            
            // Clear any pending requests
            this.clearQueue();
            
            // Clear interceptors
            this.observers.clear();
            
            this.initialized = false;
            logService.debug('RequestQueueService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup', error);
            throw error;
        }
    }
}

export const requestQueueService = new RequestQueueService(); 