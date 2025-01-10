import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { API_BASE_URL } from '../config/api.js';

export class DataManager extends BaseManager {
    constructor(uiManager) {
        super();
        this.uiManager = uiManager;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minut
    }

    async initialize() {
        try {
            await super.initialize();
            await this.clearExpiredCache();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async fetchData(endpoint, params = {}, forceRefresh = false) {
        try {
            const cacheKey = this.generateCacheKey(endpoint, params);
            
            // Check cache first if not forcing refresh
            if (!forceRefresh) {
                const cachedData = this.getFromCache(cacheKey);
                if (cachedData) {
                    return cachedData;
                }
            }

            // Show loading state
            this.uiManager.showMessage('loading', 'Pobieranie danych...');

            // Build URL with parameters
            const url = new URL(endpoint, API_BASE_URL);
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });

            // Fetch data
            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Cache the result
            this.setInCache(cacheKey, data);

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

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setInCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    async clearExpiredCache() {
        try {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp >= this.cacheTimeout) {
                    this.cache.delete(key);
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'clearExpiredCache'
            });
        }
    }

    async clearCache() {
        try {
            this.cache.clear();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'clearCache'
            });
        }
    }

    async refreshData() {
        try {
            // Clear cache first
            await this.clearCache();

            // Get selected store
            const { selectedStore } = await chrome.storage.local.get('selectedStore');
            if (!selectedStore) {
                throw new Error('No store selected');
            }

            // Send refresh request to background
            const response = await this.sendMessage({
                type: 'FETCH_DARWINA_DATA',
                selectedStore,
                forceRefresh: true
            });

            if (response?.error) {
                throw new Error(response.error);
            }

            // Update storage with new data
            if (response?.counts) {
                await chrome.storage.local.set({ 
                    leadCounts: response.counts,
                    lastUpdate: Date.now()
                });
            }

            // Emit data refresh event
            this.emit('dataRefreshed', { counts: response?.counts });

            return response;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.ERROR, {
                method: 'refreshData'
            });
            throw error;
        }
    }

    async checkStatus() {
        try {
            const statuses = {
                api: false,
                auth: false,
                data: false,
                cache: false
            };

            // Check API & Auth in one call
            const response = await this.sendMessage({
                type: 'CHECK_API_STATUS'
            });

            statuses.api = response?.apiStatus || false;
            statuses.auth = response?.authStatus || false;

            // Check data access
            const { leadCounts } = await chrome.storage.local.get('leadCounts');
            statuses.data = !!leadCounts;

            // Check cache
            statuses.cache = this.cache.size > 0;

            // Emit status update
            this.emit('statusUpdated', statuses);

            return statuses;
        } catch (error) {
            this.handleError(error, ErrorType.SYSTEM, ErrorSeverity.WARNING, {
                method: 'checkStatus'
            });
            return {
                api: false,
                auth: false,
                data: false,
                cache: false
            };
        }
    }

    dispose() {
        try {
            this.clearCache();
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 