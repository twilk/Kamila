/**
 * @typedef {Object} RequestOptions
 * @property {string} [method] - HTTP method
 * @property {Object.<string, string>} [headers] - Request headers
 * @property {string} [body] - Request body
 * @property {Object.<string, any>} [params] - URL parameters
 * @property {number} [timeout] - Request timeout in ms
 */

/**
 * @typedef {Object} APIResponse
 * @property {boolean} success - Whether the request was successful
 * @property {*} [data] - Response data
 * @property {string} [error] - Error message
 * @property {Object} [metadata] - Response metadata
 * @property {number} [metadata.page] - Current page number
 * @property {number} [metadata.page_count] - Total number of pages
 * @property {number} [metadata.total_count] - Total number of items
 * @property {number} [metadata.timestamp] - Response timestamp
 */

import { BaseManager } from '../core/BaseManager.js';
import { LogManager } from '../core/LogManager.js';
import { CacheManager } from '../core/CacheManager.js';
import { ErrorHandler } from '../core/ErrorHandler.js';
import { EndpointTTL, CacheLimits, CachePriorities } from '../../config/cache.js';

class APIManager extends BaseManager {
    static _instance = null;
    _baseURL = chrome.runtime.getManifest().api_url || 'https://api.darwina.pl/v1';
    _apiKey = '';
    _logger = LogManager.getInstance();
    _cache = CacheManager.getInstance();
    _errorHandler = ErrorHandler.getInstance();
    
    // Nowe pola z API.js
    _requestQueue = [];
    _isProcessingQueue = false;
    _retryConfig = {
        maxRetries: 3,
        delay: 1000,
        backoffFactor: 2
    };

    /**
     * Get singleton instance
     * @returns {APIManager}
     */
    static getInstance() {
        if (!APIManager._instance) {
            APIManager._instance = new APIManager();
        }
        return APIManager._instance;
    }

    constructor() {
        if (APIManager._instance) {
            throw new Error('Use APIManager.getInstance()');
        }
        super('APIManager');
        this._initializeApiKey();
    }

    /**
     * Initialize API key from storage
     * @private
     */
    async _initializeApiKey() {
        try {
            const result = await chrome.storage.local.get(['apiKey']);
            this._apiKey = result.apiKey || '';
        } catch (error) {
            this._logger.error('Failed to initialize API key', error);
        }
    }

    /**
     * Make API request
     * @param {string} endpoint - API endpoint
     * @param {RequestOptions} [options={}] - Request options
     * @returns {Promise<APIResponse>}
     */
    async request(endpoint, options = {}) {
        const cacheKey = this._generateCacheKey(endpoint, options);
        
        // Check cache for GET requests
        if (options.method === 'GET') {
            const cachedResponse = await this._cache.get(cacheKey, {
                ttl: this._getTTL(endpoint),
                priority: this._getPriority(endpoint)
            });
            
            if (cachedResponse) {
                this._logger.debug('Returning cached response', { endpoint });
                return cachedResponse;
            }
        }

        // Add request to queue
        return new Promise((resolve, reject) => {
            this._requestQueue.push({
                endpoint,
                options,
                resolve,
                reject,
                retries: 0
            });
            this._processQueue();
        });
    }

    /**
     * Process request queue
     * @private
     */
    async _processQueue() {
        if (this._isProcessingQueue || this._requestQueue.length === 0) return;
        
        this._isProcessingQueue = true;
        this._logger.debug('Processing request queue', { queueLength: this._requestQueue.length });
        
        while (this._requestQueue.length > 0) {
            const request = this._requestQueue[0];
            
            try {
                const result = await this._executeRequest(request.endpoint, request.options);
                request.resolve(result);
                
                // Cache GET responses
                if (request.options.method === 'GET') {
                    const cacheKey = this._generateCacheKey(request.endpoint, request.options);
                    await this._cache.set(cacheKey, result, {
                        ttl: this._getTTL(request.endpoint),
                        priority: this._getPriority(request.endpoint)
                    });
                }
            } catch (error) {
                if (request.retries < this._retryConfig.maxRetries) {
                    request.retries++;
                    const delay = this._retryConfig.delay * Math.pow(this._retryConfig.backoffFactor, request.retries - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                request.reject(error);
            }
            
            this._requestQueue.shift();
        }
        
        this._isProcessingQueue = false;
        this._logger.debug('Request queue processing completed');
    }

    /**
     * Execute HTTP request
     * @private
     * @param {string} endpoint - API endpoint
     * @param {RequestOptions} options - Request options
     * @returns {Promise<APIResponse>}
     */
    async _executeRequest(endpoint, options) {
        const url = new URL(endpoint, this._baseURL);
            
        if (options.method === 'GET' && options.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }

        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                'Authorization': `Bearer ${this._apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include',
            timeout: options.timeout || 5000
        };

        if (options.body) {
            requestOptions.body = options.body;
        }

        this._logger.debug('Executing API request', { url: url.toString(), options: requestOptions });

        const response = await fetch(url.toString(), requestOptions);
        
        if (!response.ok) {
            const error = new Error(`API request failed: ${response.statusText}`);
            error.status = response.status;
            throw error;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * Generate cache key
     * @private
     * @param {string} endpoint - API endpoint
     * @param {RequestOptions} options - Request options
     * @returns {string}
     */
    _generateCacheKey(endpoint, options) {
        return `api:${endpoint}:${JSON.stringify(options)}`;
    }

    /**
     * Get TTL for endpoint
     * @private
     * @param {string} endpoint - API endpoint
     * @returns {number} TTL in milliseconds
     */
    _getTTL(endpoint) {
        return EndpointTTL[endpoint] || EndpointTTL.default;
    }

    /**
     * Get cache priority for endpoint
     * @private
     * @param {string} endpoint - API endpoint
     * @returns {string} Cache priority
     */
    _getPriority(endpoint) {
        return CachePriorities[endpoint] || CachePriorities.default;
    }

    /**
     * Get user data
     * @param {string} userId - User ID
     * @returns {Promise<APIResponse>}
     */
    async getUserData(userId) {
        return this.request(`/users/${userId}`);
    }

    /**
     * Update user data
     * @param {string} userId - User ID
     * @param {Object} data - User data
     * @returns {Promise<APIResponse>}
     */
    async updateUserData(userId, data) {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Get store data
     * @param {string} storeId - Store ID
     * @returns {Promise<APIResponse>}
     */
    async getStoreData(storeId) {
        return this.request(`/stores/${storeId}`);
    }

    /**
     * Update store data
     * @param {string} storeId - Store ID
     * @param {Object} data - Store data
     * @returns {Promise<APIResponse>}
     */
    async updateStoreData(storeId, data) {
        return this.request(`/stores/${storeId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Get ranking data
     * @param {Object} params - Query parameters
     * @returns {Promise<APIResponse>}
     */
    async getRankingData(params) {
        return this.request('/rankings', {
            method: 'GET',
            params
        });
    }

    /**
     * Update ranking
     * @param {string} rankingId - Ranking ID
     * @param {Object} data - Ranking data
     * @returns {Promise<APIResponse>}
     */
    async updateRanking(rankingId, data) {
        return this.request(`/rankings/${rankingId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Generate report
     * @param {Object} params - Report parameters
     * @returns {Promise<APIResponse>}
     */
    async generateReport(params) {
        return this.request('/reports/generate', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Send metrics
     * @param {Object} data - Metrics data
     * @returns {Promise<APIResponse>}
     */
    async sendMetrics(data) {
        return this.request('/metrics', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Get metrics
     * @param {Object} params - Query parameters
     * @returns {Promise<APIResponse>}
     */
    async getMetrics(params) {
        return this.request('/metrics', {
            method: 'GET',
            params
        });
    }
}

// Export both class and instance
export { APIManager };
export const apiManager = APIManager.getInstance(); 