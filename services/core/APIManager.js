import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../constants.js';
import { API_CONFIG } from '../../config/api.js';

const API_DEFAULTS = {
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RATE_LIMIT: {
        REQUESTS_PER_MINUTE: 60,
        BURST_SIZE: 10
    },
    CACHE_TTL: 5 * 60 * 1000 // 5 minutes
};

/**
 * Manager for handling API requests
 * @extends BaseManager
 */
class APIManager extends BaseManager {
    static #instance = null;
    static _registry = null;

    /** @private */
    #requestQueue = [];
    #processing = false;
    #rateLimiter = {
        requests: [],
        timeout: null
    };
    #metrics = {
        totalRequests: 0,
        failedRequests: 0,
        cachedResponses: 0,
        averageResponseTime: 0
    };
    #cache = new Map();

    // Private method declarations
    // #validateRequestOptions = undefined;
    // #checkRateLimit = undefined;
    // #setupRateLimiter = undefined;
    // #checkCache = undefined;
    // #getCacheKey = undefined;
    // #makeRequest = undefined;
    // #updateMetrics = undefined;
    // #cacheResponse = undefined;
    // #loadConfig = undefined;

    constructor(registry) {
        if (APIManager.#instance) {
            return APIManager.#instance;
        }
        super(registry, 'api');
        APIManager.#instance = this;
        APIManager._registry = registry;
        
        this.addDependency('error');
        this.addDependency('cache');
        this.addDependency('event');
    }

    static getInstance() {
        if (!APIManager.#instance && APIManager._registry) {
            APIManager.#instance = new APIManager(APIManager._registry);
        }
        return APIManager.#instance;
    }

    static setRegistry(registry) {
        APIManager._registry = registry;
        BaseManager.setRegistry(registry);
    }

    /**
     * Initialize API manager
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing API manager...');
            
            // Get required dependencies
            const [errorHandler, cacheManager, eventManager] = await Promise.all([
                this.getDependency('error'),
                this.getDependency('cache'),
                this.getDependency('event')
            ]);

            // Validate required dependencies
            if (!errorHandler?.isInitialized()) {
                throw new Error('ErrorHandler must be initialized');
            }
            if (!cacheManager?.isInitialized()) {
                throw new Error('CacheManager must be initialized');
            }
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }
            
            // Setup rate limiter
            this.log(LogLevel.DEBUG, '⚙️ Setting up rate limiter...');
            this.#setupRateLimiter();
            this.log(LogLevel.DEBUG, '✅ Rate limiter setup complete');
            
            // Load API configuration
            this.log(LogLevel.DEBUG, '⚙️ Loading API configuration...');
            await this.#loadConfig();
            this.log(LogLevel.DEBUG, '✅ API configuration loaded');

            this.log(LogLevel.SUCCESS, '✅ API manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Make an API request
     * @param {Object} options Request options
     * @returns {Promise<Object>} Response data
     */
    async request(options) {
        const startTime = Date.now();

        try {
            // Validate options
            this.#validateRequestOptions(options);

            // Check rate limit
            await this.#checkRateLimit();

            // Check cache
            const cachedResponse = await this.#checkCache(options);
            if (cachedResponse) {
                this.#metrics.cachedResponses++;
                return cachedResponse;
            }

            // Make request
            const response = await this.#makeRequest(options);

            // Update metrics
            this.#updateMetrics(startTime);

            // Cache response if needed
            if (options.cache) {
                await this.#cacheResponse(options, response);
            }

            return response;
        } catch (error) {
            this.#metrics.failedRequests++;
            throw error;
        }
    }

    /**
     * Make a GET request
     * @param {string} url URL
     * @param {Object} [options] Request options
     */
    async get(url, options = {}) {
        return this.request({
            ...options,
            method: 'GET',
            url
        });
    }

    /**
     * Make a POST request
     * @param {string} url URL
     * @param {Object} data Request data
     * @param {Object} [options] Request options
     */
    async post(url, data, options = {}) {
        return this.request({
            ...options,
            method: 'POST',
            url,
            data
        });
    }

    /**
     * Make a PUT request
     * @param {string} url URL
     * @param {Object} data Request data
     * @param {Object} [options] Request options
     */
    async put(url, data, options = {}) {
        return this.request({
            ...options,
            method: 'PUT',
            url,
            data
        });
    }

    /**
     * Make a DELETE request
     * @param {string} url URL
     * @param {Object} [options] Request options
     */
    async delete(url, options = {}) {
        return this.request({
            ...options,
            method: 'DELETE',
            url
        });
    }

    /**
     * Validate request options
     * @private
     */
    #validateRequestOptions(options) {
        if (!options?.url) {
            throw new Error('URL is required');
        }

        if (options.timeout && typeof options.timeout !== 'number') {
            throw new Error('Timeout must be a number');
        }

        if (options.retryAttempts && typeof options.retryAttempts !== 'number') {
            throw new Error('Retry attempts must be a number');
        }
    }

    /**
     * Check rate limit
     * @private
     */
    async #checkRateLimit() {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window

        // Remove old requests
        this.#rateLimiter.requests = this.#rateLimiter.requests.filter(
            timestamp => timestamp > windowStart
        );

        // Check rate limit
        if (this.#rateLimiter.requests.length >= API_DEFAULTS.RATE_LIMIT.REQUESTS_PER_MINUTE) {
            throw new Error('Rate limit exceeded');
        }

        // Add current request
        this.#rateLimiter.requests.push(now);
    }

    /**
     * Setup rate limiter
     * @private
     */
    #setupRateLimiter() {
        if (this.#rateLimiter.timeout) {
            clearInterval(this.#rateLimiter.timeout);
        }

        this.#rateLimiter.timeout = setInterval(() => {
            const now = Date.now();
            const windowStart = now - 60000;
            this.#rateLimiter.requests = this.#rateLimiter.requests.filter(
                timestamp => timestamp > windowStart
            );
        }, 60000);
    }

    /**
     * Check cache for response
     * @private
     */
    async #checkCache(options) {
        if (!options.cache) return null;

        const cacheKey = this.#getCacheKey(options);
        const cached = this.#cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < API_DEFAULTS.CACHE_TTL) {
            return cached.data;
        }

        return null;
    }

    /**
     * Get cache key for request
     * @private
     */
    #getCacheKey(options) {
        return `${options.method}:${options.url}:${JSON.stringify(options.data || {})}`;
    }

    /**
     * Make HTTP request
     * @private
     */
    async #makeRequest(options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, options.timeout || API_DEFAULTS.TIMEOUT);

        try {
            const response = await fetch(options.url, {
                method: options.method,
                headers: options.headers,
                body: options.data ? JSON.stringify(options.data) : undefined,
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Update request metrics
     * @private
     */
    #updateMetrics(startTime) {
        const requestTime = Date.now() - startTime;
        this.#metrics.totalRequests++;
        this.#metrics.averageResponseTime = 
            (this.#metrics.averageResponseTime * (this.#metrics.totalRequests - 1) + requestTime) / 
            this.#metrics.totalRequests;
    }

    /**
     * Cache response
     * @private
     */
    async #cacheResponse(options, response) {
        const cacheKey = this.#getCacheKey(options);
        this.#cache.set(cacheKey, {
            data: response,
            timestamp: Date.now()
        });
    }

    /**
     * Load API configuration
     * @private
     */
    #loadConfig() {
        try {
            // Validate required configuration
            if (!API_CONFIG.BASE_URL) {
                throw new Error('API base URL is required');
            }

            if (!API_CONFIG.ENDPOINTS?.AUTH) {
                throw new Error('Auth endpoint is required');
            }

            // Apply configuration
            this.#rateLimiter.maxRequests = API_CONFIG.RATE_LIMIT?.REQUESTS_PER_MINUTE || API_DEFAULTS.RATE_LIMIT.REQUESTS_PER_MINUTE;
            this.#rateLimiter.burstSize = API_CONFIG.RATE_LIMIT?.BURST_SIZE || API_DEFAULTS.RATE_LIMIT.BURST_SIZE;

            this.log(LogLevel.DEBUG, '📝 API configuration loaded', {
                baseUrl: API_CONFIG.BASE_URL,
                endpoints: API_CONFIG.ENDPOINTS,
                rateLimit: this.#rateLimiter
            });

            return true;
        } catch (error) {
            this.log(LogLevel.ERROR, `❌ Failed to load API configuration: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get API manager metrics
     * @returns {Object} Metrics object
     */
    getMetrics() {
        return {
            ...super.getMetrics(),
            api: {
                ...this.#metrics,
                rateLimit: {
                    current: this.#rateLimiter.requests.length,
                    limit: API_DEFAULTS.RATE_LIMIT.REQUESTS_PER_MINUTE
                },
                cache: {
                    size: this.#cache.size,
                    hits: this.#metrics.cachedResponses
                }
            }
        };
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        if (this.#rateLimiter.timeout) {
            clearInterval(this.#rateLimiter.timeout);
        }
        this.#cache.clear();
        this.#requestQueue = [];
        this.#processing = false;
    }
}

// Export class only
export { APIManager }; 