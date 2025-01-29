import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { uiManager } from './UIManager.js';
import { dataManager } from './DataManager.js';
import { stores, validateStore, filterStoresByDeliveryMethod } from '../../services/stores.js';
import { API_CONFIG, sendLogToPopup } from '../../config/api.js';

/**
 * @typedef {Object} Store
 * @property {string} id - ID sklepu
 * @property {string} name - Nazwa sklepu
 * @property {string} [address] - Adres sklepu
 * @property {number} [deliveryId] - ID punktu dostawy
 */

/**
 * @typedef {Object} StoreCacheConfig
 * @property {string} key - Klucz cache'a
 * @property {number} expiration - Czas wygaśnięcia w ms
 * @property {string} version - Wersja cache'a
 */

/**
 * @extends {BaseManager}
 * Manages store selection and caching
 */
export class StoreManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!StoreManager._instance) {
            StoreManager._instance = new StoreManager();
        }
        return StoreManager._instance;
    }

    /** @type {StoreCacheConfig} */
    static CACHE_CONFIG = {
        key: 'store_data',
        expiration: 24 * 60 * 60 * 1000, // 24 hours
        version: '1.0'
    };

    constructor() {
        super('StoreManager');
        if (StoreManager._instance) {
            throw new Error('Use StoreManager.getInstance()');
        }

        /** @type {Store|null} */
        this._currentStore = null;
        this._stores = new Map();
        this._uiManager = null;
        this._dataManager = null;
        this._isLoading = false;
        this._initialized = false;
        this._initPromise = null;
    }

    /**
     * Initialize store manager with optimized loading
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        if (this._initialized) return true;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            try {
                this._isLoading = true;
                
                // Get manager instances (moved before store loading)
                this._uiManager = uiManager;
                this._dataManager = dataManager;

                // Load stores and last store in parallel
                const [storesLoaded, lastStoreLoaded] = await Promise.all([
                    this._loadStores(),
                    this._loadLastStore()
                ]);

                if (!storesLoaded) {
                    throw new Error('Failed to load stores');
                }

                // Setup UI only after successful data load
                this._setupStoreSelector();

                this._initialized = true;
                this.log(LogLevel.SUCCESS, '🏪 Store manager initialized');
                sendLogToPopup('Store manager initialized', 'success');
                return true;
            } catch (error) {
                this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                    method: 'initialize'
                });
                sendLogToPopup('Failed to initialize store manager', 'error', error.message);
                return false;
            } finally {
                this._isLoading = false;
                this._initPromise = null;
            }
        })();

        return this._initPromise;
    }

    /**
     * Load stores with optimized caching
     * @private
     * @returns {Promise<boolean>}
     */
    async _loadStores() {
        try {
            // Initialize stores from static configuration first
            this._stores.clear();
            stores.forEach(store => {
                if (store?.id) {
                    this._stores.set(store.id, store);
                }
            });

            // Try loading from cache in parallel with initialization
            const cachedData = await this._loadFromCache();
            if (cachedData) {
                cachedData.forEach(([id, store]) => {
                    if (store?.id) {
                        this._stores.set(id, store);
                    }
                });
            }

            // Update cache only if needed
            if (!cachedData) {
                await this._updateCache(Array.from(this._stores.entries()));
            }

            this.log(LogLevel.DEBUG, '🏪 Stores loaded', {
                count: this._stores.size,
                fromCache: !!cachedData
            });
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: '_loadStores'
            });
            return false;
        }
    }

    /**
     * Load stores from cache
     * @private
     * @returns {Promise<Array|null>}
     */
    async _loadFromCache() {
        try {
            const { key, expiration, version } = StoreManager.CACHE_CONFIG;
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
     * Update cache with stores data
     * @private
     * @param {Array} data - Stores data to cache
     * @returns {Promise<void>}
     */
    async _updateCache(data) {
        try {
            const { key, version } = StoreManager.CACHE_CONFIG;
            await chrome.storage.local.set({
                [key]: {
                    data,
                    timestamp: Date.now(),
                    cacheVersion: version
                }
            });

            this.log(LogLevel.DEBUG, '💾 Stores cache updated');
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.LOW, {
                method: '_updateCache'
            });
        }
    }

    /**
     * Setup store selector with optimized DOM operations
     * @private
     */
    _setupStoreSelector() {
        try {
            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Add "All stores" option
            const allStores = stores.find(s => s.id === 'ALL');
            if (allStores) {
                const option = document.createElement('option');
                option.value = allStores.id;
                option.textContent = allStores.name;
                option.selected = !this._currentStore;
                fragment.appendChild(option);
            }

            // Add remaining stores in batch
            const sortedStores = Array.from(this._stores.values())
                .filter(store => store.id !== 'ALL')
                .sort((a, b) => a.name.localeCompare(b.name));

            sortedStores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = `${store.name} - ${store.address || ''}`;
                option.selected = this._currentStore?.id === store.id;
                fragment.appendChild(option);
            });

            // Update DOM once
            this._uiManager.safeUpdateElement('#store-select', select => {
                select.innerHTML = '';
                select.appendChild(fragment);
                select.disabled = this._isLoading || this._stores.size === 0;

                // Add change handler
                const existingHandler = select._storeChangeHandler;
                if (existingHandler) {
                    select.removeEventListener('change', existingHandler);
                }

                const handler = async (event) => {
                    const newStoreId = event.target.value;
                    await this.changeStore(newStoreId);
                };

                select._storeChangeHandler = handler;
                select.addEventListener('change', handler);
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_setupStoreSelector'
            });
        }
    }

    /**
     * Load last selected store
     * @private
     * @returns {Promise<void>}
     */
    async _loadLastStore() {
        try {
            const { lastStore } = await chrome.storage.local.get('lastStore');
            if (lastStore && this._stores.has(lastStore)) {
                await this.changeStore(lastStore);
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '_loadLastStore'
            });
        }
    }

    /**
     * Change current store
     * @param {string} storeId - Store ID to change to
     * @returns {Promise<boolean>}
     */
    async changeStore(storeId) {
        try {
            // Validate store using the imported function
            const store = validateStore(storeId);
            
            // Update current store
            this._currentStore = store;

            // Update UI
            this._uiManager.safeUpdateElement('#store-select', select => {
                select.value = storeId;
            });

            // Save to storage
            await chrome.storage.local.set({ lastStore: storeId });

            // Trigger store change event
            window.dispatchEvent(new CustomEvent('store:change', {
                detail: { storeId }
            }));

            this.log(LogLevel.DEBUG, '🔄 Store changed', { store });
            sendLogToPopup(`Changed store to: ${store.name}`, 'success');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'changeStore',
                storeId
            });
            sendLogToPopup('Failed to change store', 'error', error.message);
            return false;
        }
    }

    /**
     * Get filtered stores based on delivery method
     * @param {string} deliveryMethod - Delivery method to filter by
     * @returns {Array<Store>}
     */
    getFilteredStores(deliveryMethod) {
        return filterStoresByDeliveryMethod(deliveryMethod);
    }

    /**
     * Get current store
     * @returns {Store|null}
     */
    getCurrentStore() {
        return this._currentStore;
    }

    /**
     * Get all stores
     * @returns {Map<string, Store>}
     */
    getStores() {
        return new Map(this._stores);
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            this._currentStore = null;
            this._stores.clear();
            this._uiManager = null;
            this._dataManager = null;
            this._isLoading = false;

            await super.dispose();
            sendLogToPopup('Store manager disposed', 'info');
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
            sendLogToPopup('Failed to dispose store manager', 'error', error.message);
        }
    }
}

// Export singleton instance
export const storeManager = StoreManager.getInstance(); 