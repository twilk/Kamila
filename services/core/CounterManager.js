import { BaseManager } from './BaseManager.js';
import { CacheManager } from './CacheManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';

/**
 * Interface for counter data structure
 * @typedef {Object} CounterCache
 * @property {Object} counts - Counter values for different statuses
 * @property {number} counts.1 - NEW orders count
 * @property {number} counts.2 - CONFIRMED orders count
 * @property {number} counts.3 - ACCEPTED orders count
 * @property {number} counts.READY - Orders ready for less than 2 weeks
 * @property {number} counts.OVERDUE - Orders ready for 2 weeks or more
 * @property {Object} metadata - Metadata about the counter state
 * @property {boolean} metadata.initialFetch - Whether initial data has been fetched
 * @property {number} metadata.lastUpdate - Timestamp of last update
 * @property {string} metadata.storeId - ID of the store these counts are for
 */

/**
 * Manager responsible for handling order counters and their states
 */
export class CounterManager extends BaseManager {
    /** @type {CounterManager} */
    static #instance = null;

    /** @type {CacheManager} */
    #cache;
    
    /** @type {string} */
    #currentStoreId;
    
    /** @type {Object} */
    #config = {
        cacheKey: 'counters',
        cacheTTL: 5 * 60 * 1000, // 5 minutes
        overdueDays: 14,
        statusMap: {
            '1': 'NEW',
            '2': 'CONFIRMED',
            '3': 'ACCEPTED',
            '5': 'READY_OR_OVERDUE'
        }
    };

    /**
     * Get singleton instance
     * @returns {CounterManager}
     */
    static getInstance() {
        if (!CounterManager.#instance) {
            CounterManager.#instance = new CounterManager({
                cacheManager: CacheManager.getInstance(),
                errorHandler: ErrorHandler.getInstance()
            });
        }
        return CounterManager.#instance;
    }

    /**
     * @param {Object} dependencies
     * @param {CacheManager} dependencies.cacheManager
     */
    constructor(dependencies) {
        super('CounterManager');
        
        // Prevent multiple instances
        if (CounterManager.#instance) {
            throw new Error('Use CounterManager.getInstance()');
        }
        
        this.#validateDependencies(dependencies);
        this.#cache = dependencies.cacheManager;
        
        CounterManager.#instance = this;
    }

    /**
     * Validates constructor dependencies
     * @param {Object} dependencies
     * @private
     */
    #validateDependencies(dependencies) {
        if (!dependencies?.cacheManager) {
            throw new Error('CacheManager is required for CounterManager');
        }
    }

    /**
     * Updates counters based on provided orders
     * @param {Array<Object>} orders - Array of order objects to process
     * @returns {Promise<void>}
     */
    async updateCounters(orders) {
        try {
            const counts = this.#initializeCounts();
            
            for (const order of orders) {
                const status = order.status_id?.toString();
                if (!status) continue;
                
                if (status === '5') {
                    const dateToCheck = order.ready_date || order.modified_at || order.created_at;
                    const orderDate = new Date(dateToCheck);
                    const twoWeeksAgo = new Date(Date.now() - this.#config.overdueDays * 24 * 60 * 60 * 1000);
                    
                    orderDate < twoWeeksAgo ? counts.OVERDUE++ : counts.READY++;
                } else if (['1', '2', '3'].includes(status)) {
                    counts[status]++;
                }
            }
            
            await this.#cache.set(
                this.#config.cacheKey, 
                { counts, metadata: this.#getMetadata() },
                this.#config.cacheTTL
            );

            this.log('Counters updated successfully', LogLevel.INFO, { counts });
        } catch (error) {
            ErrorHandler.handle(error, 'Error updating counters');
            throw error;
        }
    }

    /**
     * Gets current counter values
     * @returns {Promise<CounterCache>}
     */
    async getCounters() {
        try {
            const cached = await this.#cache.get(this.#config.cacheKey);
            if (cached) {
                return cached;
            }
            
            return {
                counts: this.#initializeCounts(),
                metadata: this.#getMetadata(false)
            };
        } catch (error) {
            ErrorHandler.handle(error, 'Error getting counters');
            throw error;
        }
    }

    /**
     * Invalidates counter cache for current store
     * @returns {Promise<void>}
     */
    async invalidateCounters() {
        try {
            await this.#cache.remove(this.#config.cacheKey);
            this.log('Counters cache invalidated', LogLevel.INFO);
        } catch (error) {
            ErrorHandler.handle(error, 'Error invalidating counters');
            throw error;
        }
    }

    /**
     * Sets current store ID for counter context
     * @param {string} storeId
     */
    setCurrentStore(storeId) {
        this.#currentStoreId = storeId;
    }

    /**
     * Initializes empty counter structure
     * @returns {Object}
     * @private
     */
    #initializeCounts() {
        return {
            '1': 0,
            '2': 0,
            '3': 0,
            'READY': 0,
            'OVERDUE': 0
        };
    }

    /**
     * Gets metadata for counter cache
     * @param {boolean} [initialFetch=true]
     * @returns {Object}
     * @private
     */
    #getMetadata(initialFetch = true) {
        return {
            initialFetch,
            lastUpdate: Date.now(),
            storeId: this.#currentStoreId
        };
    }
} 