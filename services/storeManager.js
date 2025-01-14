import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { stores } from './stores.js';
import { storageManager } from './storage.js';
import { STORAGE_KEYS } from '../config/storage.js';

export class StoreManager extends BaseManager {
    constructor() {
        super();
        this.currentStore = null;
        this.storeChangeListeners = new Set();
    }

    async initialize() {
        try {
            // Load initial store from storage
            const storedStoreId = await storageManager.load(STORAGE_KEYS.SELECTED_STORE);
            
            // If no store is selected, try to get the previous store
            if (!storedStoreId) {
                const previousStore = await storageManager.load(STORAGE_KEYS.PREVIOUS_STORE);
                if (previousStore) {
                    console.log('[INFO] ℹ️ Restoring previous store:', previousStore);
                    await this.changeStore(previousStore);
                } else {
                    console.log('[INFO] ℹ️ No previous store found, defaulting to ALL');
                    await this.changeStore('ALL');
                }
                return true;
            }

            // Validate and set the stored store
            const validatedStore = await this.validateStore(storedStoreId);
            if (validatedStore) {
                this.currentStore = validatedStore;
                console.log('[INFO] ℹ️ Store initialized:', validatedStore.id);
            } else {
                console.warn('[WARNING] ⚠️ Invalid stored store, defaulting to ALL');
                await this.changeStore('ALL');
            }
            
            return true;
        } catch (error) {
            console.error('[ERROR] ❌ StoreManager initialization error:', error);
            // Even on error, ensure we have a default store
            await this.changeStore('ALL');
            return true;
        }
    }

    async validateStore(storeId) {
        // Handle null/undefined case silently during initialization
        if (!storeId) {
            return null;
        }
        
        // If storeId is a metadata wrapper, extract the value
        if (storeId.hasOwnProperty('value')) {
            storeId = storeId.value;
        }
        
        // Handle 'ALL' as a special case
        if (storeId === 'ALL') {
            return { 
                id: 'ALL', 
                name: 'Wszystkie sklepy', 
                deliveryId: null, 
                drwn: null,
                isSpecial: true 
            };
        }
        
        // If storeId is an object, try to get the id property
        const id = typeof storeId === 'object' ? storeId.id : storeId;
        
        // Find store in the stores list
        if (!stores || !Array.isArray(stores)) {
            console.error('[ERROR] ❌ Stores list not available');
            return null;
        }

        const store = stores.find(s => s.id === id);
        if (!store) {
            // Only log warning if this is not during initialization
            if (this.currentStore !== null) {
                console.warn(`[WARNING] ⚠️ Store ${id} not found in stores list`);
            }
            return null;
        }

        // Validate store configuration
        if (!store.deliveryId && !store.isSpecial) {
            console.warn(`[WARNING] ⚠️ Store ${id} has no delivery ID configured`);
        }
        
        return {
            ...store,
            isValid: true,
            lastValidated: Date.now()
        };
    }

    // Sprawdzanie dostępności API dla sklepu
    async isApiAvailable(storeId) {
        try {
            const store = this.validateStore(storeId);
            
            // Sprawdź czy sklep ma skonfigurowane API
            if (!store.drwn) {
                console.warn(`[WARNING] ⚠️ Store ${storeId} has no API configuration`);
                return false;
            }

            // Sprawdź status API
            return await this.checkApiStatus(store);
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH, {
                method: 'isApiAvailable',
                storeId
            });
            return false;
        }
    }

    // Sprawdzanie statusu API
    async checkApiStatus(store) {
        try {
            if (!store.drwn) return false;

            const response = await fetch(`${store.drwn}/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('[ERROR] ❌ API status check failed:', error);
            return false;
        }
    }

    // Zmiana aktualnego sklepu
    async changeStore(newStoreId) {
        try {
            // Validate new store
            const store = await this.validateStore(newStoreId);
            if (!store) {
                throw new Error(`Invalid store: ${newStoreId}`);
            }
            
            // If store hasn't changed, don't do anything
            if (this.currentStore?.id === store.id) {
                return true;
            }

            // Save previous store for comparison
            const previousStore = this.currentStore;
            
            // Update current store
            this.currentStore = store;

            // Save to storage
            await storageManager.save(STORAGE_KEYS.SELECTED_STORE, store.id);
            if (previousStore) {
                await storageManager.save(STORAGE_KEYS.PREVIOUS_STORE, previousStore.id);
            }

            // Clear cache for previous store
            if (previousStore) {
                await this.clearStoreCache(previousStore.id);
            }

            // Log store change
            console.log(`[INFO] 🏪 Store changed from ${previousStore?.id || 'none'} to ${store.id}`);

            // Emit store change event
            this.emit('storeChanged', {
                previousStore: previousStore?.id,
                newStore: store.id,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORE, ErrorSeverity.HIGH, {
                method: 'changeStore',
                newStoreId
            });
            return false;
        }
    }

    // Pobranie aktualnego sklepu
    async getCurrentStore() {
        try {
            if (this.currentStore) {
                return this.currentStore;
            }

            const storedStoreId = await storageManager.load(STORAGE_KEYS.SELECTED_STORE);
            if (!storedStoreId) {
                return null;
            }

            const store = await this.validateStore(storedStoreId);
            if (store) {
                this.currentStore = store;
            }
            return store;
        } catch (error) {
            console.warn('[WARNING] ⚠️ Error getting current store:', error);
            return null;
        }
    }

    // Czyszczenie cache dla sklepu
    async clearStoreCache(storeId) {
        try {
            const cacheKeys = [
                `store_${storeId}`,
                `leads_${storeId}`,
                `counts_${storeId}`,
                `data_${storeId}`
            ];

            await Promise.all(cacheKeys.map(key => storageManager.remove(key)));
            console.log(`[DEBUG] 🧹 Cleared cache for store ${storeId}`);
        } catch (error) {
            console.warn(`[WARNING] ⚠️ Failed to clear cache for store ${storeId}:`, error);
        }
    }

    // Filtrowanie sklepów według metody dostawy
    filterStoresByDeliveryMethod(deliveryMethod) {
        if (deliveryMethod === 'PICKUP') {
            return stores.filter(store => store.id !== 'ALL');
        }
        return stores.filter(store => 
            store.id !== 'ALL' && 
            store.deliveryId && 
            store.deliveryId !== 3 // PICKUP delivery ID
        );
    }

    // Formatowanie punktu odbioru
    formatPickupPoint(storeId) {
        const store = this.validateStore(storeId);
        return store ? `Punkt odbioru: ${store.address}` : '';
    }

    // Dodanie listenera zmiany sklepu
    addStoreChangeListener(listener) {
        this.storeChangeListeners.add(listener);
    }

    // Usunięcie listenera zmiany sklepu
    removeStoreChangeListener(listener) {
        this.storeChangeListeners.delete(listener);
    }

    // Emitowanie eventu
    emit(eventName, data) {
        if (eventName === 'storeChanged') {
            this.storeChangeListeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error('Error in store change listener:', error);
                }
            });
        }
    }

    // Pobranie wszystkich sklepów
    getAllStores() {
        return stores;
    }
}

// Eksportuj singleton
export const storeManager = new StoreManager(); 