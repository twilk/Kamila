import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../constants.js';
import { DataManager } from './DataManager.js';
import { stores, validateStore, filterStoresByDeliveryMethod } from '../../services/stores.js';
import { API_CONFIG, sendLogToPopup } from '../../config/api.js';
import { cacheManager } from './CacheManager.js';
import { updateUrlParameters } from '../../utils/url.js';
import { EventManager } from './EventManager.js';
import { createOrderService } from '../api/OrderService.js';

/**
 * @typedef {Object} Store
 * @property {string} id Store ID
 * @property {string} name Store name
 * @property {boolean} active Store active status
 */

/**
 * @typedef {Object} StoreCacheConfig
 * @property {string} key - Klucz cache'a
 * @property {number} expiration - Czas wygaśnięcia w ms
 * @property {string} version - Wersja cache'a
 */

/**
 * Manager for handling store operations and state
 * @extends BaseManager
 */
class StoreManager extends BaseManager {
    static #instance = null;
    static _registry = null;

    /** @private */
    #stores = new Map();

    /** @private */
    #activeStore = null;

    /** @private */
    #storageKey = 'stores';

    /** @private */
    #lastSync = 0;

    /** @private */
    #syncInterval = 5 * 60 * 1000; // 5 minutes

    constructor(registry) {
        if (StoreManager.#instance) {
            return StoreManager.#instance;
        }
        super(registry, 'store');
        StoreManager.#instance = this;
        StoreManager._registry = registry;
        
        this.addDependency('storage');
        this.addDependency('error');
        this.addDependency('event');
    }

    static getInstance() {
        if (!StoreManager.#instance && StoreManager._registry) {
            StoreManager.#instance = new StoreManager(StoreManager._registry);
        }
        return StoreManager.#instance;
    }

    static setRegistry(registry) {
        StoreManager._registry = registry;
    }

    /**
     * Initialize store manager
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing store manager...');
            
            // Get required dependencies
            const [storage, error, eventManager] = await Promise.all([
                this.getDependency('storage'),
                this.getDependency('error'),
                this.getDependency('event')
            ]);

            // Validate required dependencies
            if (!storage?.isInitialized()) {
                throw new Error('Storage manager must be initialized');
            }

            // Load stores from storage or use default
            const data = await storage.get(this.#storageKey);
            
            // Initialize stores Map with data from stores.js
            stores.forEach(store => {
                this.#stores.set(store.id, store);
            });

            // If we have stored data, merge it
            if (data?.stores) {
                for (const [id, store] of Object.entries(data.stores)) {
                    if (this.#stores.has(id)) {
                        this.#stores.set(id, { ...this.#stores.get(id), ...store });
                    }
                }
            }

            // Set active store from storage or default to 'ALL'
            if (data?.activeStore && this.#stores.has(data.activeStore)) {
                this.#activeStore = data.activeStore;
            } else {
                this.#activeStore = 'ALL';
            }

            this.#lastSync = Date.now();
            
            // Start sync interval
            this.#startSync();
            
            // Emit stores loaded event
            if (eventManager?.isInitialized()) {
                await eventManager.emit('stores:loaded', {
                    stores: Array.from(this.#stores.values()),
                    activeStore: this.#activeStore
                });
            }
            
            this.log(LogLevel.SUCCESS, '✅ Store manager initialized', {
                storeCount: this.#stores.size,
                activeStore: this.#activeStore
            });
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Start store sync
     * @private
     */
    #startSync() {
        setInterval(async () => {
            try {
                await this.#syncStores();
            } catch (error) {
                this.handleError(error, ErrorType.STORE_SYNC, ErrorSeverity.LOW);
            }
        }, this.#syncInterval);
    }

    /**
     * Sync stores with storage
     * @private
     */
    async #syncStores() {
        if (Date.now() - this.#lastSync < this.#syncInterval) return;

        try {
            const storage = await this.getDependency('storage');
            await storage.set(this.#storageKey, {
                stores: Object.fromEntries(this.#stores),
                activeStore: this.#activeStore,
                lastSync: Date.now()
            });

            this.#lastSync = Date.now();
            
            // Emit sync event
            const eventManager = await this.getDependency('event');
            await eventManager.emit('stores:synced', {
                timestamp: this.#lastSync,
                storeCount: this.#stores.size
            });
        } catch (error) {
            throw new Error(`Failed to sync stores: ${error.message}`);
        }
    }

    /**
     * Add or update a store
     * @param {Store} store Store object
     */
    async addStore(store) {
        if (!store?.id || !store?.name) {
            throw new Error('Invalid store data');
        }

        this.#stores.set(store.id, {
            ...store,
            active: store.active ?? true
        });

        await this.#syncStores();

        // Emit store added/updated event
        const eventManager = await this.getDependency('event');
        await eventManager.emit('store:updated', { store });
    }

    /**
     * Remove a store
     * @param {string} storeId Store ID
     */
    async removeStore(storeId) {
        if (!this.#stores.has(storeId)) {
            throw new Error(`Store ${storeId} not found`);
        }

        const store = this.#stores.get(storeId);
        this.#stores.delete(storeId);

        if (this.#activeStore === storeId) {
            this.#activeStore = null;
        }

        await this.#syncStores();

        // Emit store removed event
        const eventManager = await this.getDependency('event');
        await eventManager.emit('store:removed', { storeId, store });
    }

    /**
     * Get a store by ID
     * @param {string} storeId Store ID
     * @returns {Store|null} Store object
     */
    getStore(storeId) {
        return this.#stores.get(storeId) || null;
    }

    /**
     * Get all stores
     * @param {Object} [options] Filter options
     * @param {boolean} [options.activeOnly] Get only active stores
     * @returns {Store[]} Array of stores
     */
    getStores(options = {}) {
        try {
            let storeArray = Array.from(this.#stores.values());

            if (options.activeOnly) {
                storeArray = storeArray.filter(store => store.active);
            }

            // Sort stores: ALL first, then alphabetically by name
            return storeArray.sort((a, b) => {
                if (a.id === 'ALL') return -1;
                if (b.id === 'ALL') return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'getStores',
                options
            });
            return [];
        }
    }

    /**
     * Get active store
     * @returns {Store|null} Active store
     */
    getActiveStore() {
        try {
            if (!this.#activeStore) return null;
            return this.#stores.get(this.#activeStore) || null;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'getActiveStore'
            });
            return null;
        }
    }

    /**
     * Set active store
     * @param {string} storeId Store ID
     */
    async setActiveStore(storeId) {
        try {
            if (!this.#stores.has(storeId)) {
                throw new Error(`Store ${storeId} not found`);
            }

            const oldStore = this.#activeStore;
            this.#activeStore = storeId;

            // Save to storage
            const storage = await this.getDependency('storage');
            await storage.set(this.#storageKey, {
                stores: Object.fromEntries(this.#stores),
                activeStore: storeId,
                lastSync: Date.now()
            });

            // Emit active store changed event
            const eventManager = await this.getDependency('event');
            await eventManager.emit('store:active', {
                oldStore,
                newStore: storeId,
                store: this.#stores.get(storeId)
            });

            this.log(LogLevel.INFO, `✅ Active store set to ${storeId}`, {
                oldStore,
                newStore: storeId
            });
        } catch (error) {
            this.handleError(error, ErrorType.STORE, ErrorSeverity.MEDIUM, {
                method: 'setActiveStore',
                storeId
            });
            throw error;
        }
    }

    /**
     * Update store status
     * @param {string} storeId Store ID
     * @param {boolean} active Active status
     */
    async updateStoreStatus(storeId, active) {
        const store = this.getStore(storeId);
        if (!store) {
            throw new Error(`Store ${storeId} not found`);
        }

        store.active = active;
        await this.addStore(store);
    }

    /**
     * Get store manager stats
     * @returns {Object} Stats object
     */
    getStats() {
        return {
            totalStores: this.#stores.size,
            activeStores: this.getStores({ activeOnly: true }).length,
            lastSync: this.#lastSync,
            activeStore: this.#activeStore
        };
    }

    /**
     * Get value by key
     * @param {string} key Key to get
     * @returns {Promise<any>} Value
     */
    async get(key) {
        try {
            const storage = await this.getDependency('storage');
            return storage.get(key);
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'get',
                key
            });
            return null;
        }
    }

    /**
     * Set value by key
     * @param {string} key Key to set
     * @param {any} value Value to set
     * @returns {Promise<void>}
     */
    async set(key, value) {
        try {
            const storage = await this.getDependency('storage');
            await storage.set(key, value);
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'set',
                key
            });
        }
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        await this.#syncStores();
        this.#stores.clear();
        this.#activeStore = null;
    }
}

// Export class only
export { StoreManager };