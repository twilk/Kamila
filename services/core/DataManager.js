import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { statusManager } from './StatusManager.js';
import { eventManager } from './EventManager.js';
import { errorHandler } from './ErrorHandler.js';

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
    static #instance = null;

    // Private fields
    #statusManager = null;
    #refreshTimer = null;
    #isRefreshing = false;
    #lastUpdate = null;
    #cache = null;

    constructor() {
        if (DataManager.#instance) {
            return DataManager.#instance;
        }
        super('DataManager');
        DataManager.#instance = this;
    }

    static getInstance() {
        if (!DataManager.#instance) {
            DataManager.#instance = new DataManager();
        }
        return DataManager.#instance;
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

    /**
     * Initialize data manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            // Get status manager instance
            this.#statusManager = statusManager;

            // Load initial data
            await this.loadAndUpdateData(true);

            // Setup refresh timer
            this.#setupRefreshTimer();
            
            // Setup event listeners
            this.#setupEventListeners();

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
    #setupEventListeners() {
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
    #setupRefreshTimer() {
        if (this.#refreshTimer) {
            clearInterval(this.#refreshTimer);
        }

        this.#refreshTimer = setInterval(async () => {
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
            if (this.#isRefreshing) {
                this.log(LogLevel.DEBUG, '🔄 Data refresh already in progress');
                return false;
            }

            this.#isRefreshing = true;

            // Check cache first
            if (!forceRefresh) {
                const cachedData = await this.#loadFromCache();
                if (cachedData) {
                    this.log(LogLevel.DEBUG, '📦 Using cached data');
                    await this.#updateData(cachedData);
                    return true;
                }
            }

            // Fetch fresh data
            const data = await this.#fetchData();
            if (!data) return false;

            // Validate data
            if (!this.#validateData(data)) {
                throw new Error('Invalid data format');
            }

            // Update cache
            await this.#updateCache(data);

            // Update UI
            await this.#updateData(data);

            this.log(LogLevel.DEBUG, '✅ Data updated successfully');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'loadAndUpdateData',
                forceRefresh
            });
            return false;
        } finally {
            this.#isRefreshing = false;
        }
    }

    /**
     * Load data from cache
     * @private
     * @returns {Promise<Object|null>}
     */
    async #loadFromCache() {
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
                method: '#loadFromCache'
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
    async #updateCache(data) {
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
                method: '#updateCache'
            });
        }
    }

    /**
     * Fetch fresh data from API
     * @private
     * @returns {Promise<Object|null>}
     */
    async #fetchData() {
        try {
            // W trybie development/offline zwracamy testowe dane
            if (!navigator.onLine || this._environment.isDevelopment) {
                return this.#getTestData();
            }

            const response = await fetch('https://api.darwina.pl/orders', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': await this.#getAuthToken()
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.MEDIUM, {
                method: '#fetchData'
            });
            return null;
        }
    }

    /**
     * Get auth token
     * @private
     * @returns {Promise<string>}
     */
    async #getAuthToken() {
        try {
            const { token } = await chrome.storage.local.get('token');
            return token || '';
        } catch (error) {
            this.handleError(error, ErrorType.AUTH, ErrorSeverity.HIGH, {
                method: '#getAuthToken'
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
    #validateData(data) {
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
                method: '#validateData'
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
    async #updateData(data) {
        try {
            // Calculate order counts
            const counts = this._calculateOrderCounts(data.orders);

            // Update status manager
            await this.#statusManager.updateOrderCounts(counts);

            // Update last update time
            this.#lastUpdate = Date.now();

            this.log(LogLevel.DEBUG, '📊 Order counts updated', { counts });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '#updateData'
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

        this.log(LogLevel.DEBUG, '📊 Starting order count calculation', { totalOrders: orders.length });

        orders.forEach(order => {
            const originalStatus = order.status;
            const mappedStatus = this.#statusManager.constructor.mapStatus(order.status);
            
            this.log(LogLevel.DEBUG, '🔄 Processing order status', {
                orderId: order.id,
                originalStatus,
                mappedStatus
            });

            if (mappedStatus in counts) {
                counts[mappedStatus]++;
                this.log(LogLevel.DEBUG, '✅ Incremented counter', {
                    status: mappedStatus,
                    newCount: counts[mappedStatus]
                });
            } else {
                this.log(LogLevel.WARN, '⚠️ Unmapped status encountered', {
                    orderId: order.id,
                    originalStatus,
                    mappedStatus
                });
            }
        });

        this.log(LogLevel.INFO, '📈 Final order counts', { counts });
        return counts;
    }

    /**
     * Get test data for development
     * @private
     * @returns {Object}
     */
    #getTestData() {
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
        return this.#lastUpdate;
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            if (this.#refreshTimer) {
                clearInterval(this.#refreshTimer);
                this.#refreshTimer = null;
            }

            this.#isRefreshing = false;
            this.#lastUpdate = null;
            this.#statusManager = null;

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }

    /**
     * Refresh data with optional configuration
     * @param {Object} options - Refresh options
     * @param {boolean} [options.force=false] - Force refresh ignoring cache
     * @param {string} [options.storeId='ALL'] - Store ID to refresh data for
     * @returns {Promise<boolean>} Success status
     */
    async refreshData(options = {}) {
        try {
            if (this.#isRefreshing) {
                this.log('🔄 Refresh already in progress, skipping', LogLevel.DEBUG);
                return false;
            }

            this.#isRefreshing = true;
            this.log('🔄 Starting data refresh...', LogLevel.INFO);

            // Emit refresh start event
            eventManager.emit('data:refresh-start');

            // Load and update data
            const success = await this.loadAndUpdateData(options.force);
            
            if (success) {
                this.#lastUpdate = Date.now();
                this.log('✅ Data refresh completed successfully', LogLevel.INFO);
                
                // Update status manager
                await statusManager.updateOrderCounts(this._calculateOrderCounts(this.#cache.data));
                
                // Emit refresh success event
                eventManager.emit('data:refresh-success');
            } else {
                this.log('❌ Data refresh failed', LogLevel.ERROR);
                // Emit refresh error event
                eventManager.emit('data:refresh-error');
            }

            return success;
        } catch (error) {
            this.handleError(error, ErrorType.DATA_REFRESH, ErrorSeverity.HIGH);
            // Emit refresh error event
            eventManager.emit('data:refresh-error', error);
            return false;
        } finally {
            this.#isRefreshing = false;
        }
    }
}

// Export singleton instance
export const dataManager = DataManager.getInstance(); 