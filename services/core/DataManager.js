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
    #isRefreshing = false;

    constructor(registry) {
        if (DataManager.#instance) {
            return DataManager.#instance;
        }
        super(registry, 'DataManager');
        DataManager.#instance = this;
        DataManager._registry = registry;
        
        // Only keep essential dependencies
        this.addDependency('event');
        this.addDependency('store');
        this.addDependency('order');
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
            // Get essential dependencies
            const [eventManager, storeManager, orderService] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('store'),
                this.getDependency('order')
            ]);
            
            // Verify dependencies
            if (!eventManager?.isInitialized()) throw new Error('EventManager not initialized');
            if (!storeManager?.isInitialized()) throw new Error('StoreManager not initialized');
            if (!orderService?.isInitialized()) throw new Error('OrderService not initialized');

            // Setup minimal event listeners
            await eventManager.on('store:change', () => this.refreshData({ forceRefresh: true }));

            this.log(LogLevel.SUCCESS, '✅ Data manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
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
        this.log(LogLevel.INFO, '🔄 Starting data refresh', { options });

        try {
            // Get active store
            const storeManager = await this.getDependency('store');
            const activeStore = await storeManager.getActiveStore();
            
            // Get order data
            const orderService = await this.getDependency('order');
            const result = await orderService.getOrderStatuses(
                activeStore?.id || 'ALL',
                options
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to get order statuses');
            }

            // Emit counter update
            const eventManager = await this.getDependency('event');
            await eventManager.emit('counters:updated', result.counts);

            this.log(LogLevel.SUCCESS, '✅ Data refresh complete', {
                storeId: activeStore?.id,
                counts: result.counts
            });
            
            return result;
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Data refresh failed', { error: error.message });
            this.handleError(error, ErrorType.DATA_REFRESH, ErrorSeverity.HIGH);
            throw error;
        } finally {
            this.#isRefreshing = false;
        }
    }

    /**
     * Clean up resources
     */
    async dispose() {
        this.#isRefreshing = false;
        await super.dispose();
    }
}

// Export class only
export { DataManager }; 