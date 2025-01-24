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

class APIManager extends BaseManager {
    static _instance = null;
    _baseURL = chrome.runtime.getManifest().api_url || 'https://api.darwina.pl/v1';
    _apiKey = '';
    _logger = LogManager.getInstance();
    _cache = CacheManager.getInstance();
    _errorHandler = ErrorHandler.getInstance();

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
        super();
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
        try {
            const cacheKey = this._generateCacheKey(endpoint, options);
            const cachedResponse = await this._cache.get(cacheKey);
            
            if (cachedResponse) {
                this._logger.debug('Returning cached response', { endpoint });
                return cachedResponse;
            }

            const response = await this._makeRequest(endpoint, options);
            await this._cache.set(cacheKey, response);
            return response;
        } catch (error) {
            this._errorHandler.handle(error);
            throw error;
        }
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
     * Make HTTP request
     * @private
     * @param {string} endpoint - API endpoint
     * @param {RequestOptions} [options={}] - Request options
     * @returns {Promise<APIResponse>}
     */
    async _makeRequest(endpoint, options = {}) {
        const url = `${this._baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this._apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: process.env.REQUEST_TIMEOUT || 5000
        };

        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        this._logger.debug('Making API request', { url, options: requestOptions });

        try {
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            this._logger.debug('API request successful', { endpoint, data });
            return data;
        } catch (error) {
            this._logger.error('API request failed', error);
            throw error;
        }
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
     * Get report status
     * @param {string} reportId - Report ID
     * @returns {Promise<APIResponse>}
     */
    async getReportStatus(reportId) {
        return this.request(`/reports/${reportId}/status`);
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

export const API = APIManager.getInstance(); 