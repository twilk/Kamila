import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { COUNTER_CONFIG } from '../../config/counter.js';

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
class CounterManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;
    
    /** @private */
    #counters = new Map();
    
    /** @private */
    #storageKey = 'counters';
    
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

    constructor(registry) {
        if (CounterManager.#instance) {
            return CounterManager.#instance;
        }
        super(registry, 'CounterManager');
        CounterManager.#instance = this;
        CounterManager._registry = registry;
    }

    /**
     * Get singleton instance
     * @returns {CounterManager}
     */
    static getInstance() {
        if (!CounterManager.#instance && CounterManager._registry) {
            CounterManager.#instance = new CounterManager(CounterManager._registry);
        }
        return CounterManager.#instance;
    }

    static setRegistry(registry) {
        CounterManager._registry = registry;
    }

    /**
     * Initialize counter manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing counter manager...');
            
            // Load existing counters
            const storage = await this.getDependency('storage');
            const existingCounters = await storage.get(COUNTER_CONFIG.STORAGE_KEY) || {};
            this.#counters = new Map(Object.entries(existingCounters));
            
            this.log(LogLevel.SUCCESS, '✅ Counter manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    async refreshCounters() {
        try {
            this.log(LogLevel.INFO, '🔄 Refreshing counters...');
            
            const orderManager = await this.getDependency('order');
            const cacheManager = await this.getDependency('cache');
            const eventManager = await this.getDependency('event');
            
            const orders = await orderManager.getOrders();
            const counts = this.calculateCounts(orders);
            
            await cacheManager.set(this.#config.cacheKey, {
                counts,
                metadata: {
                    initialFetch: true,
                    lastUpdate: Date.now(),
                    storeId: this.#currentStoreId
                }
            });
            
            eventManager.emit('counters:updated', counts);
            
            this.log(LogLevel.SUCCESS, '✅ Counters refreshed', { counts });
            return counts;
        } catch (error) {
            this.handleError(error, ErrorType.REFRESH, ErrorSeverity.MEDIUM);
            throw error;
        }
    }

    async handleOrdersUpdate(event) {
        try {
            const { orders } = event;
            await this.refreshCounters();
        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.MEDIUM);
        }
    }

    async handleStoreChange(event) {
        try {
            const { storeId } = event;
            this.#currentStoreId = storeId;
            await this.refreshCounters();
        } catch (error) {
            this.handleError(error, ErrorType.EVENT, ErrorSeverity.MEDIUM);
        }
    }

    calculateCounts(orders) {
        const counts = {
            '1': 0,
            '2': 0,
            '3': 0,
            'READY': 0,
            'OVERDUE': 0
        };

        orders.forEach(order => {
            if (order.status_id === '5') {
                const dateToCheck = order.ready_date || order.modified_at || order.created_at;
                const orderDate = new Date(dateToCheck);
                const twoWeeksAgo = new Date(Date.now() - this.#config.overdueDays * 24 * 60 * 60 * 1000);
                
                if (orderDate < twoWeeksAgo) {
                    counts.OVERDUE++;
                } else {
                    counts.READY++;
                }
            } else if (counts.hasOwnProperty(order.status_id)) {
                counts[order.status_id]++;
            }
        });

        return counts;
    }
}

// Export both class and instance
export { CounterManager };
export const counterManager = CounterManager.getInstance();