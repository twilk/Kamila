import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { API_BASE_URL } from '../config/api.js';
import { CacheManager } from './core/CacheManager.js';
import { CachePriority } from './core/CacheManager.js';
import { ConnectionManager } from './core/ConnectionManager.js';
import { UIManager } from './core/UIManager.js';
import { storageManager } from './storage.js';
import { storeManager } from './storeManager.js';
import { OrderService } from './api/drwn.js';
import { getDarwinaCredentials } from '../config/api.js';
import { stores } from './stores.js';
import { STORAGE_KEYS } from '../config/storage.js';

export class DataManager extends BaseManager {
    constructor(uiManager) {
        super();
        this._uiManager = uiManager;
        this._cacheManager = null;
        this._connectionManager = null;
    }

    async initialize() {
        try {
            // Create and initialize CacheManager if not provided
            if (!this.dependencies.has(CacheManager)) {
                const cacheManager = new CacheManager();
                await cacheManager.initialize();
                this.dependencies.add(cacheManager);
            }

            // Initialize base after dependencies are ready
            await super.initialize();

            // Get dependencies
            this._cacheManager = Array.from(this.dependencies).find(dep => dep instanceof CacheManager);
            this._uiManager = Array.from(this.dependencies).find(dep => dep instanceof UIManager);

            if (!this._cacheManager) {
                throw new Error('CacheManager dependency not found');
            }
            if (!this._uiManager) {
                throw new Error('UIManager dependency not found');
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.ERROR, {
                method: 'initialize',
                context: 'Failed to initialize DataManager'
            });
            return false;
        }
    }

    async fetchData(endpoint, params = {}, forceRefresh = false) {
        try {
            const cacheKey = this.generateCacheKey(endpoint, params);
            
            // Check cache first if not forcing refresh
            if (!forceRefresh) {
                const cachedData = await this._cacheManager.get(cacheKey);
                if (cachedData) {
                    return cachedData;
                }
            }

            // Show loading state
            this.uiManager.showMessage('loading', 'Pobieranie danych...');

            // Get API credentials
            const credentials = await getDarwinaCredentials();
            if (!credentials) {
                throw new Error('Missing API credentials');
            }

            // Initialize OrderService
            const orderService = new OrderService(credentials);

            // Fetch data based on current store
            const currentStore = await storeManager.getCurrentStore();
            const data = await orderService.fetchAllOrders(currentStore);

            if (!data.success) {
                throw new Error('Failed to fetch data from API');
            }
            
            // Cache the result with high priority for frequently accessed data
            await this._cacheManager.set(cacheKey, data, {
                priority: CachePriority.HIGH,
                ttl: 300000 // 5 minutes
            });

            // Hide loading message
            this.uiManager.hideMessage('loading');

            return data;
        } catch (error) {
            this.handleError(error, ErrorType.NETWORK, ErrorSeverity.ERROR, {
                method: 'fetchData',
                endpoint,
                params
            });
            this.uiManager.showMessage('error', 'Błąd podczas pobierania danych');
            throw error;
        }
    }

    generateCacheKey(endpoint, params) {
        return `${endpoint}:${JSON.stringify(params)}`;
    }

    async clearCache() {
        try {
            await this._cacheManager.clear();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'clearCache'
            });
        }
    }

    async refreshData(forceRefresh = false) {
        try {
            const currentStore = await storeManager.getCurrentStore();
            if (!currentStore) {
                throw new Error('No store selected');
            }

            // Check if we can use cached data
            if (!forceRefresh) {
                const cachedData = await storageManager.load(STORAGE_KEYS.STORE_DATA(currentStore.id));
                if (cachedData && this.isDataFresh(cachedData)) {
                    console.log('[DEBUG] 📦 Using cached data for store:', currentStore.id);
                    return cachedData;
                }
            }

            // Show loading state
            this.emit('loading:start');

            // Get API credentials
            const credentials = await getDarwinaCredentials();
            if (!credentials) {
                throw new Error('Missing API credentials');
            }

            // Initialize OrderService
            const orderService = new OrderService(credentials);
            
            // Check if store has API configuration
            if (!currentStore.drwn && currentStore.id !== 'ALL') {
                throw new Error(`Store ${currentStore.id} has no API configuration`);
            }

            // Fetch data
            let data;
            if (currentStore.id === 'ALL') {
                // For 'ALL' store, aggregate data from all stores
                data = await this.fetchAggregatedData(orderService);
            } else {
                // For specific store
                data = await orderService.fetchLeadCounts(currentStore.drwn);
            }

            // Validate data
            if (!this.validateCountsData(data?.counts)) {
                throw new Error('Invalid data received from API');
            }

            // Save to storage
            await storageManager.save(STORAGE_KEYS.STORE_DATA(currentStore.id), {
                ...data,
                timestamp: Date.now()
            });

            // Emit update event
            this.emit('data:updated', data);

            return data;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.HIGH, {
                method: 'refreshData',
                store: currentStore?.id || 'unknown'
            });
            throw error;
        } finally {
            this.emit('loading:end');
        }
    }

    // Helper method to fetch aggregated data from all stores
    async fetchAggregatedData(orderService) {
        const availableStores = stores.filter(store => store.id !== 'ALL' && store.drwn);
        const allData = await Promise.all(
            availableStores.map(store => orderService.fetchLeadCounts(store.drwn))
        );

        // Aggregate counts
        const aggregatedCounts = {
            '1': 0,
            '2': 0,
            '3': 0,
            'READY': 0,
            'OVERDUE': 0
        };

        allData.forEach(data => {
            if (data?.counts) {
                Object.entries(data.counts).forEach(([status, count]) => {
                    aggregatedCounts[status] = (aggregatedCounts[status] || 0) + (count || 0);
                });
            }
        });

        return {
            counts: aggregatedCounts,
            success: true
        };
    }

    // Validate counts data
    validateCountsData(counts) {
        if (!counts || typeof counts !== 'object') {
            return false;
        }

        const requiredStatuses = ['1', '2', '3', 'READY', 'OVERDUE'];
        return requiredStatuses.every(status => 
            typeof counts[status] === 'number' && 
            counts[status] >= 0
        );
    }

    // Check if data is fresh (less than 5 minutes old)
    isDataFresh(data) {
        if (!data?.timestamp) return false;
        const now = Date.now();
        const dataAge = now - data.timestamp;
        return dataAge < 5 * 60 * 1000; // 5 minutes
    }
} 