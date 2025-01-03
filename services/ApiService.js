import { logService } from './LogService.js';
import { requestQueueService } from './RequestQueueService.js';
import { cacheService } from './CacheService.js';

/**
 * Service for handling API requests with caching and request queuing
 */
export class ApiService {
    constructor() {
        this.baseUrl = '';
        this.apiKey = '';
        this.initialized = false;
        this.apiStats = {
            totalCalls: 0,
            successCalls: 0,
            errorCalls: 0,
            lastResponse: null,
            lastError: null,
            lastCallTime: null,
            responseTimeMs: 0,
            endpoints: new Map() // Track calls per endpoint
        };
        this.listeners = new Set();
        logService.info('ApiService constructed');
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('ApiService already initialized');
            return;
        }

        try {
            logService.info('Initializing ApiService...');
            
            // Initialize with default config
            this.defaultHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            
            this.initialized = true;
            logService.info('ApiService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize ApiService', error);
            throw error;
        }
    }

    async get(url, options = {}) {
        if (!this.initialized) {
            throw new Error('Cannot make requests before initialization');
        }

        const cacheKey = this.getCacheKey(url, options);
        const cachedResponse = await cacheService.get(cacheKey);

        if (cachedResponse) {
            logService.debug(`Cache hit for ${url}`);
            return cachedResponse;
        }

        try {
            const response = await this.request('GET', url, options);
            if (!options.noCache) {
                await cacheService.set(cacheKey, response);
            }
            return response;
        } catch (error) {
            logService.error(`API request failed: ${url}`, error);
            throw error;
        }
    }

    async post(endpoint, data, options = {}) {
        if (!this.initialized) {
            throw new Error('Cannot make requests before initialization');
        }

        return this.request('POST', endpoint, {
            ...options,
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data, options = {}) {
        if (!this.initialized) {
            throw new Error('Cannot make requests before initialization');
        }

        return this.request('PUT', endpoint, {
            ...options,
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint, options = {}) {
        if (!this.initialized) {
            throw new Error('Cannot make requests before initialization');
        }

        return this.request('DELETE', endpoint, options);
    }

    async request(method, endpoint, options = {}) {
        if (!this.initialized) {
            throw new Error('Cannot make requests before initialization');
        }

        const url = this.buildUrl(endpoint);
        logService.debug(`Making ${method} request to ${url}`);

        try {
            const requestConfig = {
                method,
                ...options,
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers
                }
            };

            if (this.apiKey) {
                requestConfig.headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await requestQueueService.enqueue({
                url,
                ...requestConfig
            });

            logService.debug(`Request completed: ${url}`, { status: response.status });
            return response;
        } catch (error) {
            logService.error(`API request failed: ${url}`, error);
            throw error;
        }
    }

    buildUrl(endpoint) {
        return endpoint.startsWith('http') 
            ? endpoint 
            : `${this.baseUrl}${endpoint}`;
    }

    getCacheKey(url, options) {
        return `api_${options.method || 'GET'}_${url}`;
    }

    async clearCache() {
        try {
            await cacheService.clear();
            logService.info('API cache cleared');
        } catch (error) {
            logService.error('Failed to clear API cache', error);
            throw error;
        }
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        logService.info('API key updated');
    }

    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
        logService.info('API base URL updated');
    }

    cleanup() {
        if (!this.initialized) return;

        try {
            logService.debug('Cleaning up ApiService...');
            this.initialized = false;
            logService.debug('ApiService cleaned up successfully');
        } catch (error) {
            logService.error('Error during cleanup', error);
            throw error;
        }
    }

    addStatsListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
    }

    removeStatsListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.apiStats);
            } catch (error) {
                console.error('Error in API stats listener:', error);
            }
        });
    }

    async fetchWithRetry(url, options = {}, retries = 3) {
        const startTime = performance.now();
        const endpoint = new URL(url).pathname;
        
        try {
            this.apiStats.totalCalls++;
            this.apiStats.lastCallTime = new Date();
            
            // Track endpoint call
            const endpointStats = this.apiStats.endpoints.get(endpoint) || { calls: 0, errors: 0 };
            endpointStats.calls++;
            this.apiStats.endpoints.set(endpoint, endpointStats);

            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update success stats
            this.apiStats.successCalls++;
            this.apiStats.lastResponse = data;
            this.apiStats.responseTimeMs = performance.now() - startTime;
            
            this.notifyListeners();
            return data;
        } catch (error) {
            // Update error stats
            this.apiStats.errorCalls++;
            this.apiStats.lastError = error;
            
            const endpointStats = this.apiStats.endpoints.get(endpoint);
            if (endpointStats) {
                endpointStats.errors++;
            }
            
            this.notifyListeners();
            throw error;
        }
    }

    getStats() {
        return this.apiStats;
    }

    async getOrders(forceRefresh = false) {
        try {
            const url = `${this.baseUrl}/orders`;
            const options = {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };
            
            return await this.fetchWithRetry(url, options);
        } catch (error) {
            logService.error('Failed to fetch orders:', error);
            throw error;
        }
    }

    async getOrderDetails(orderId) {
        try {
            const url = `${this.baseUrl}/orders/${orderId}`;
            const options = {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };
            
            return await this.fetchWithRetry(url, options);
        } catch (error) {
            logService.error('Failed to fetch order details:', error);
            throw error;
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const url = `${this.baseUrl}/orders/${orderId}/status`;
            const options = {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            };
            
            return await this.fetchWithRetry(url, options);
        } catch (error) {
            logService.error('Failed to update order status:', error);
            throw error;
        }
    }
}

export const apiService = new ApiService(); 