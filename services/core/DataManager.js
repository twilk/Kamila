import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { statusManager } from './StatusManager.js';

/**
 * @typedef {Object} CacheConfig
 * @property {string} key - Klucz cache'a
 * @property {number} expiration - Czas wygaśnięcia w ms
 * @property {string} version - Wersja cache'a
 */

/**
 * @typedef {Object} RefreshConfig
 * @property {number} interval - Interwał odświeżania w ms
 * @property {boolean} forceRefresh - Czy wymusić odświeżenie
 * @property {number} retryAttempts - Liczba prób ponowienia
 */

/**
 * @extends {BaseManager}
 * Manages data operations and caching
 */
export class DataManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!DataManager._instance) {
            DataManager._instance = new DataManager();
        }
        return DataManager._instance;
    }

    /** @type {CacheConfig} */
    static CACHE_CONFIG = {
        key: 'orders_data',
        expiration: 5 * 60 * 1000, // 5 minut
        version: '1.0'
    };

    /** @type {RefreshConfig} */
    static REFRESH_CONFIG = {
        interval: 30 * 1000, // 30 sekund
        forceRefresh: false,
        retryAttempts: 3
    };

    constructor() {
        super('DataManager');
        if (DataManager._instance) {
            throw new Error('Use DataManager.getInstance()');
        }

        this._statusManager = null;
        this._refreshTimer = null;
        this._isRefreshing = false;
        this._lastUpdate = null;
    }

    /**
     * Initialize data manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            await super.initialize();

            // Get status manager instance
            this._statusManager = statusManager;

            // Load initial data
            await this.loadAndUpdateData(true);

            // Setup refresh timer
            this._setupRefreshTimer();

            // Setup event listeners
            this._setupEventListeners();

            this.log(LogLevel.SUCCESS, '✨ Data manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        // Listen for manual refresh requests
        window.addEventListener('data:refresh', async () => {
            await this.loadAndUpdateData(true);
        });

        // Listen for store changes
        window.addEventListener('store:change', async () => {
            await this.loadAndUpdateData(true);
        });
    }

    /**
     * Setup refresh timer
     * @private
     */
    _setupRefreshTimer() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
        }

        this._refreshTimer = setInterval(async () => {
            await this.loadAndUpdateData();
        }, DataManager.REFRESH_CONFIG.interval);
    }

    /**
     * Load and update data
     * @param {boolean} [forceRefresh=false] - Whether to force refresh
     * @returns {Promise<boolean>}
     */
    async loadAndUpdateData(forceRefresh = false) {
        try {
            if (this._isRefreshing) {
                this.log(LogLevel.DEBUG, '🔄 Data refresh already in progress');
                return false;
            }

            this._isRefreshing = true;

            // Check cache first
            if (!forceRefresh) {
                const cachedData = await this._loadFromCache();
                if (cachedData) {
                    this.log(LogLevel.DEBUG, '📦 Using cached data');
                    await this._updateData(cachedData);
                    return true;
                }
            }

            // Fetch fresh data
            const data = await this._fetchData();
            if (!data) return false;

            // Validate data
            if (!this._validateData(data)) {
                throw new Error('Invalid data format');
            }

            // Update cache
            await this._updateCache(data);

            // Update UI
            await this._updateData(data);

            this.log(LogLevel.DEBUG, '✅ Data updated successfully');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'loadAndUpdateData',
                forceRefresh
            });
            return false;
        } finally {
            this._isRefreshing = false;
        }
    }

    /**
     * Load data from cache
     * @private
     * @returns {Promise<Object|null>}
     */
    async _loadFromCache() {
        try {
            const { key, expiration, version } = DataManager.CACHE_CONFIG;
            const cached = await chrome.storage.local.get(key);

            if (!cached[key]) return null;

            const { data, timestamp, cacheVersion } = cached[key];
            const age = Date.now() - timestamp;

            // Check expiration and version
            if (age > expiration || cacheVersion !== version) {
                return null;
            }

            return data;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW, {
                method: '_loadFromCache'
            });
            return null;
        }
    }

    /**
     * Update cache with new data
     * @private
     * @param {Object} data - Data to cache
     * @returns {Promise<void>}
     */
    async _updateCache(data) {
        try {
            const { key, version } = DataManager.CACHE_CONFIG;
            await chrome.storage.local.set({
                [key]: {
                    data,
                    timestamp: Date.now(),
                    cacheVersion: version
                }
            });

            this.log(LogLevel.DEBUG, '💾 Cache updated');
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW, {
                method: '_updateCache'
            });
        }
    }

    /**
     * Fetch fresh data from API
     * @private
     * @returns {Promise<Object|null>}
     */
    async _fetchData() {
        try {
            // W trybie development/offline zwracamy testowe dane
            if (!navigator.onLine || this._environment.isDevelopment) {
                return this._getTestData();
            }

            const response = await fetch('https://api.darwina.pl/orders', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': await this._getAuthToken()
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.MEDIUM, {
                method: '_fetchData'
            });
            return null;
        }
    }

    /**
     * Get auth token
     * @private
     * @returns {Promise<string>}
     */
    async _getAuthToken() {
        try {
            const { token } = await chrome.storage.local.get('token');
            return token || '';
        } catch (error) {
            this.handleError(error, ErrorType.AUTH, ErrorSeverity.HIGH, {
                method: '_getAuthToken'
            });
            return '';
        }
    }

    /**
     * Validate data format
     * @private
     * @param {Object} data - Data to validate
     * @returns {boolean}
     */
    _validateData(data) {
        try {
            if (!data || typeof data !== 'object') return false;
            if (!Array.isArray(data.orders)) return false;
            
            // Validate order format
            return data.orders.every(order => (
                order &&
                typeof order === 'object' &&
                typeof order.id === 'string' &&
                typeof order.status === 'string'
            ));
        } catch (error) {
            this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.LOW, {
                method: '_validateData'
            });
            return false;
        }
    }

    /**
     * Update data in UI
     * @private
     * @param {Object} data - Data to update
     * @returns {Promise<void>}
     */
    async _updateData(data) {
        try {
            // Calculate order counts
            const counts = this._calculateOrderCounts(data.orders);

            // Update status manager
            await this._statusManager.updateOrderCounts(counts);

            // Update last update time
            this._lastUpdate = Date.now();

            this.log(LogLevel.DEBUG, '📊 Order counts updated', { counts });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_updateData'
            });
        }
    }

    /**
     * Calculate order counts by status
     * @private
     * @param {Array} orders - Orders array
     * @returns {Object}
     */
    _calculateOrderCounts(orders) {
        const counts = {
            '1': 0,
            '2': 0,
            '3': 0,
            'READY': 0,
            'OVERDUE': 0
        };

        orders.forEach(order => {
            const status = this._statusManager.constructor.mapStatus(order.status);
            if (status in counts) {
                counts[status]++;
            }
        });

        return counts;
    }

    /**
     * Get test data for development
     * @private
     * @returns {Object}
     */
    _getTestData() {
        return {
            orders: [
                { id: '1', status: 'submitted' },
                { id: '2', status: 'confirmed' },
                { id: '3', status: 'accepted' },
                { id: '4', status: 'ready' },
                { id: '5', status: 'overdue' }
            ]
        };
    }

    /**
     * Get last update timestamp
     * @returns {number|null}
     */
    getLastUpdate() {
        return this._lastUpdate;
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            if (this._refreshTimer) {
                clearInterval(this._refreshTimer);
                this._refreshTimer = null;
            }

            this._isRefreshing = false;
            this._lastUpdate = null;
            this._statusManager = null;

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const dataManager = DataManager.getInstance(); 