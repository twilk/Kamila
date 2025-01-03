import { logService } from './LogService.js';
import { stores } from '../config/stores.js';

class StoreService {
    constructor() {
        this.initialized = false;
        this.currentStore = null;
        this.stores = stores;
        logService.info('StoreService constructed');
    }

    async initialize() {
        try {
            logService.info('Initializing StoreService...');
            
            // Load current store
            await this.loadCurrentStore();
            
            this.initialized = true;
            logService.info('StoreService initialized successfully');
            return true;
        } catch (error) {
            logService.error('Failed to initialize StoreService:', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    async loadCurrentStore() {
        try {
            const result = await chrome.storage.local.get('selectedStore');
            this.currentStore = result.selectedStore;
            
            if (!this.currentStore) {
                logService.warn('No store selected, selecting default store');
                await this.selectDefaultStore();
            }
            
            logService.debug('Current store loaded:', this.currentStore);
            return this.currentStore;
        } catch (error) {
            logService.error('Failed to load current store:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async selectDefaultStore() {
        try {
            const firstStore = this.stores.find(store => store.id !== 'ALL');
            if (!firstStore) {
                throw new Error('No stores available');
            }
            
            await this.setCurrentStore(firstStore.id);
            logService.info(`Auto-selected default store: ${firstStore.id}`);
            return firstStore.id;
        } catch (error) {
            logService.error('Failed to select default store:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async setCurrentStore(storeId) {
        try {
            if (!storeId) {
                throw new Error('Store ID is required');
            }
            
            // Validate store exists
            const store = this.stores.find(s => s.id === storeId);
            if (!store) {
                throw new Error(`Invalid store ID: ${storeId}`);
            }
            
            // Save to storage
            await chrome.storage.local.set({ selectedStore: storeId });
            this.currentStore = storeId;
            
            logService.info(`Store changed to: ${storeId}`);
            return true;
        } catch (error) {
            logService.error('Failed to set current store:', {
                error: error.message,
                stack: error.stack,
                storeId
            });
            throw error;
        }
    }

    getCurrentStore() {
        return this.currentStore;
    }

    getAvailableStores() {
        return this.stores.filter(store => store.id !== 'ALL');
    }

    getStoreById(storeId) {
        return this.stores.find(store => store.id === storeId);
    }

    validateStore(storeId) {
        const store = this.getStoreById(storeId);
        return !!store;
    }

    cleanup() {
        this.initialized = false;
        this.currentStore = null;
        logService.debug('StoreService cleaned up');
    }
}

export const storeService = new StoreService(); 