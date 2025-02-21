import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { OrderService } from '../api/OrderService.js';

/**
 * Central manager for order-related operations
 * @extends BaseManager
 */
class OrderManager extends BaseManager {
    /** @private */
    static #instance = null;
    
    /** @private */
    #lastUpdateTimestamp = null;
    
    /** @private */
    #orderCache = new Map();
    
    /** @private */
    #currentStore = 'ALL';
    
    /** @private */
    #orderService = null;
    
    /** @private */
    #isInitialized = false;

    constructor(registry) {
        if (OrderManager.#instance) {
            return OrderManager.#instance;
        }
        super(registry, 'OrderManager');
        OrderManager.#instance = this;
        OrderManager._registry = registry;
    }

    /**
     * Get singleton instance
     * @returns {OrderManager}
     */
    static getInstance() {
        if (!OrderManager.#instance && OrderManager._registry) {
            OrderManager.#instance = new OrderManager(OrderManager._registry);
        }
        return OrderManager.#instance;
    }

    static setRegistry(registry) {
        OrderManager._registry = registry;
    }

    /**
     * Initialize order manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing order manager...');
            
            // Add required dependencies
            this.addDependency('event');
            this.addDependency('message');
            
            // Get dependencies
            const eventManager = await this.getDependency('event');
            const messageManager = await this.getDependency('message');
            
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }

            if (!messageManager?.isInitialized()) {
                throw new Error('MessageManager must be initialized');
            }

            // Initialize order service
            this.#orderService = await OrderService.getInstance();
            
            // Load state from storage
            await this.#loadState();
            
            // Setup message handlers
            messageManager.addHandler('POPUP_INITIALIZED', async () => {
                const orders = Array.from(this.#orderCache.values());
                await this.broadcastUpdate(orders);
            });

            messageManager.addHandler('REFRESH_REQUESTED', async () => {
                await this.refreshData();
            });

            messageManager.addHandler('STORE_CHANGED', async (message) => {
                await this.handleStoreChange(message.payload.store);
            });
            
            // Mark as initialized before data operations
            this.#isInitialized = true;
            
            // Initial data load if needed
            if (!this.#lastUpdateTimestamp) {
                await this.refreshData();
            } else {
                await this.fetchDeltaUpdates();
            }
            
            this.log(LogLevel.SUCCESS, '✅ Order manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Load state from storage
     * @private
     */
    async #loadState() {
        const [timestampData, storeData] = await Promise.all([
            chrome.storage.local.get('lastUpdateTimestamp'),
            chrome.storage.local.get('currentStore')
        ]);
        
        this.#lastUpdateTimestamp = timestampData?.lastUpdateTimestamp;
        this.#currentStore = storeData?.currentStore || 'ALL';
    }

    /**
     * Fetch all orders for current store
     * @param {string} [store='ALL'] Store ID
     * @returns {Promise<Array>} Fetched orders
     */
    async fetchAllOrders(store = 'ALL') {
        try {
            this.log(LogLevel.INFO, '📥 Fetching all orders...', { store });
            const orders = await this.#orderService.fetchOrders({ store });
            this.#updateCache(orders);
            return orders;
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH);
            throw error;
        }
    }

    /**
     * Fetch only updated orders since last update
     * @returns {Promise<Array>} Modified orders
     */
    async fetchDeltaUpdates() {
        try {
            if (!this.#lastUpdateTimestamp) return [];
            
            this.log(LogLevel.INFO, '🔄 Fetching delta updates...', {
                from: new Date(this.#lastUpdateTimestamp).toISOString(),
                store: this.#currentStore
            });

            const modifiedOrders = await this.#orderService.fetchOrders({
                store: this.#currentStore,
                modified_from: new Date(this.#lastUpdateTimestamp).toISOString()
            });
            
            this.#updateCache(modifiedOrders);
            return modifiedOrders;
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.MEDIUM);
            throw error;
        }
    }

    /**
     * Update internal cache with new orders
     * @private
     * @param {Array} orders Orders to cache
     */
    #updateCache(orders) {
        try {
            orders.forEach(order => {
                this.#orderCache.set(order.id, order);
            });
            this.#lastUpdateTimestamp = Date.now();
            this.#saveState();
            
            this.log(LogLevel.DEBUG, '💾 Cache updated', {
                totalCached: this.#orderCache.size,
                newOrders: orders.length
            });
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW);
        }
    }

    /**
     * Save current state to storage
     * @private
     */
    async #saveState() {
        try {
            await chrome.storage.local.set({
                lastUpdateTimestamp: this.#lastUpdateTimestamp,
                currentStore: this.#currentStore
            });
            
            this.log(LogLevel.DEBUG, '💾 State saved to storage');
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW);
        }
    }

    /**
     * Refresh all data
     * @returns {Promise<void>}
     */
    async refreshData() {
        try {
            this.log(LogLevel.INFO, '🔄 Refreshing all data...');
            
            this.#orderCache.clear();
            const orders = await this.fetchAllOrders(this.#currentStore);
            await this.broadcastUpdate(orders);
            
            this.log(LogLevel.SUCCESS, '✅ Data refresh complete');
        } catch (error) {
            this.handleError(error, ErrorType.DATA_REFRESH, ErrorSeverity.HIGH);
            throw error;
        }
    }

    /**
     * Handle store change
     * @param {string} newStore New store ID
     * @returns {Promise<void>}
     */
    async handleStoreChange(newStore) {
        try {
            this.log(LogLevel.INFO, '🏪 Handling store change', {
                from: this.#currentStore,
                to: newStore
            });
            
            this.#currentStore = newStore;
            await this.#saveState();
            await this.fetchDeltaUpdates();
            
            this.log(LogLevel.SUCCESS, '✅ Store change handled');
        } catch (error) {
            this.handleError(error, ErrorType.STORE_CHANGE, ErrorSeverity.MEDIUM);
            throw error;
        }
    }

    /**
     * Broadcast update to all listeners
     * @param {Array} orders Updated orders
     * @returns {Promise<void>}
     */
    async broadcastUpdate(orders) {
        try {
            this.log(LogLevel.INFO, '📢 Broadcasting update...', {
                orderCount: orders.length
            });
            
            this.addDependency('message');
            const messageManager = await this.getDependency('message');
            
            messageManager.broadcast({
                type: 'ORDERS_UPDATED',
                payload: {
                    orders,
                    timestamp: Date.now(),
                    store: this.#currentStore
                }
            });
            
            this.log(LogLevel.SUCCESS, '✅ Update broadcast complete');
        } catch (error) {
            this.handleError(error, ErrorType.BROADCAST, ErrorSeverity.MEDIUM);
        }
    }

    /**
     * Get cached orders
     * @returns {Array} Array of cached orders
     */
    getCache() {
        return Array.from(this.#orderCache.values());
    }

    /**
     * Check if manager is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.#isInitialized;
    }
}

// Export both class and instance
export { OrderManager };
export const orderManager = OrderManager.getInstance(); 