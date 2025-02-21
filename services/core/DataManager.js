import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

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

const DATA_CONFIG = {
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    SYNC_INTERVAL: 60 * 1000, // 1 minute
    BATCH_SIZE: 100,
    MAX_RETRIES: 3
};

/**
 * Manager for handling data operations and state
 * @extends BaseManager
 */
class DataManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #pendingChanges = new Map();

    /** @private */
    #processing = false;

    /** @private */
    #lastSync = 0;

    /** @private */
    #isRefreshing = false;

    /** @private */
    #metrics = {
        syncAttempts: 0,
        refreshAttempts: 0,
        errors: []
    };

    constructor(registry) {
        if (DataManager.#instance) {
            return DataManager.#instance;
        }
        super(registry, 'DataManager');
        DataManager.#instance = this;
        DataManager._registry = registry;
        
        // Add dependencies as strings
        this.addDependency('event');
        this.addDependency('store');
        this.addDependency('api');
        this.addDependency('cache');
    }

    /**
     * Get singleton instance
     * @returns {DataManager}
     */
    static getInstance() {
        if (!DataManager.#instance && DataManager._registry) {
            DataManager.#instance = new DataManager(DataManager._registry);
        }
        return DataManager.#instance;
    }

    /**
     * Set registry for all instances
     * @param {ManagerRegistry} registry Manager registry
     */
    static setRegistry(registry) {
        DataManager._registry = registry;
    }

    /**
     * Initialize data manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            // Get dependencies
            const eventManager = await this.getDependency('event');
            const storeManager = await this.getDependency('store');
            const apiManager = await this.getDependency('api');
            const cacheManager = await this.getDependency('cache');
            
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }

            if (!storeManager?.isInitialized()) {
                throw new Error('StoreManager must be initialized');
            }

            if (!apiManager?.isInitialized()) {
                throw new Error('APIManager must be initialized');
            }

            if (!cacheManager?.isInitialized()) {
                throw new Error('CacheManager must be initialized');
            }

            // Setup event listeners
            await this.#setupEventListeners();

            this.log(LogLevel.SUCCESS, '✅ Data manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Setup event listeners
     * @private
     */
    async #setupEventListeners() {
        try {
            const eventManager = await this.getDependency('event');
            eventManager.subscribe('data:refresh', this.refreshData.bind(this));
            eventManager.subscribe('store:change', this.handleStoreChange.bind(this));
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH);
        }
    }

    /**
     * Handle store change event
     * @private
     */
    async handleStoreChange(event) {
        try {
            const { newStore } = event;
            await this.refreshData({ forceRefresh: true });
        } catch (error) {
            this.handleError(error, ErrorType.STORE_CHANGE, ErrorSeverity.MEDIUM);
        }
    }

    /**
     * Refresh data
     * @param {Object} options Refresh options
     * @returns {Promise<void>}
     */
    async refreshData(options = {}) {
        if (this.#isRefreshing) {
            this.log(LogLevel.WARN, '⚠️ Data refresh already in progress');
            return;
        }

        this.#isRefreshing = true;
        this.log(LogLevel.INFO, '🔄 Starting data refresh...');

        try {
            const eventManager = await this.getDependency('event');
            await eventManager.emit('data:refresh-start');

            // Get dependencies
            const storeManager = await this.getDependency('store');
            const apiManager = await this.getDependency('api');
            const cacheManager = await this.getDependency('cache');

            const activeStore = storeManager.getActiveStore();
            
            // Fetch data
            const response = await apiManager.get('/data', {
                params: {
                    storeId: activeStore?.id
                }
            });

            // Process and cache data
            await this.#processData(response.data);

            // Emit success event
            await eventManager.emit('data:refresh-success', {
                timestamp: Date.now(),
                storeId: activeStore?.id
            });

            this.log(LogLevel.SUCCESS, '✅ Data refresh complete');
        } catch (error) {
            this.handleError(error, ErrorType.DATA_REFRESH, ErrorSeverity.HIGH);
            const eventManager = await this.getDependency('event');
            await eventManager.emit('data:refresh-error', error);
        } finally {
            this.#isRefreshing = false;
        }
    }

    /**
     * Process and cache data
     * @private
     */
    async #processData(data) {
        try {
            const cacheManager = await this.getDependency('cache');
            await cacheManager.set('data', data, {
                ttl: DATA_CONFIG.CACHE_TTL
            });

            const eventManager = await this.getDependency('event');
            await eventManager.emit('data:cache-cleared');
            this.log(LogLevel.INFO, '🧹 Cache cleared successfully');
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.MEDIUM);
            throw error;
        }
    }

    /**
     * Get metrics
     * @returns {Object} Metrics object
     */
    getMetrics() {
        return {
            ...this.#metrics,
            lastSync: this.#lastSync,
            pendingChanges: this.#pendingChanges.size,
            isProcessing: this.#processing,
            isRefreshing: this.#isRefreshing
        };
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            this.#pendingChanges.clear();
            this.#processing = false;
            this.#isRefreshing = false;
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH);
        }
    }
}

// Export class only
export { DataManager }; 