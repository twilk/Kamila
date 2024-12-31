import { logService } from './LogService.js';

/**
 * Service for handling cache operations
 */
class CacheService {
    constructor() {
        this.cache = new Map();
        this.isInitialized = false;
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
        logService.info('CacheService constructed', { defaultTTL: this.defaultTTL });
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            logService.info('Initializing CacheService...');
            await this.loadFromStorage();
            this.startCleanupInterval();
            this.isInitialized = true;
            logService.info('CacheService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize CacheService', error);
            throw error;
        }
    }

    async loadFromStorage() {
        try {
            logService.debug('Loading cache from storage...');
            const data = await chrome.storage.local.get('cache');
            if (data.cache) {
                Object.entries(data.cache).forEach(([key, value]) => {
                    if (!this.isExpired(value)) {
                        this.cache.set(key, value);
                    }
                });
            }
            logService.debug('Cache loaded successfully', { size: this.cache.size });
        } catch (error) {
            logService.error('Failed to load cache from storage', error);
            throw error;
        }
    }

    startCleanupInterval() {
        setInterval(() => this.cleanup(), 60 * 1000); // Cleanup every minute
        logService.debug('Cache cleanup interval started');
    }

    async set(key, value, ttl = this.defaultTTL) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                ttl
            };
            this.cache.set(key, item);
            await this.saveToStorage();
            logService.debug('Cache item set', { key, ttl });
        } catch (error) {
            logService.error('Failed to set cache item', error);
            throw error;
        }
    }

    async get(key) {
        const item = this.cache.get(key);
        if (!item) {
            logService.debug('Cache miss', { key });
            return null;
        }

        if (this.isExpired(item)) {
            logService.debug('Cache item expired', { key });
            this.cache.delete(key);
            await this.saveToStorage();
            return null;
        }

        logService.debug('Cache hit', { key });
        return item.value;
    }

    async delete(key) {
        try {
            this.cache.delete(key);
            await this.saveToStorage();
            logService.debug('Cache item deleted', { key });
        } catch (error) {
            logService.error('Failed to delete cache item', error);
            throw error;
        }
    }

    async clear() {
        try {
            this.cache.clear();
            await this.saveToStorage();
            logService.info('Cache cleared');
        } catch (error) {
            logService.error('Failed to clear cache', error);
            throw error;
        }
    }

    isExpired(item) {
        return Date.now() - item.timestamp > item.ttl;
    }

    async cleanup() {
        try {
            let cleanedCount = 0;
            for (const [key, item] of this.cache.entries()) {
                if (this.isExpired(item)) {
                    this.cache.delete(key);
                    cleanedCount++;
                }
            }
            if (cleanedCount > 0) {
                await this.saveToStorage();
                logService.debug('Cache cleanup completed', { cleanedCount });
            }
        } catch (error) {
            logService.error('Failed to cleanup cache', error);
            throw error;
        }
    }

    async saveToStorage() {
        try {
            const data = {};
            this.cache.forEach((value, key) => {
                data[key] = value;
            });
            await chrome.storage.local.set({ cache: data });
            logService.debug('Cache saved to storage', { size: this.cache.size });
        } catch (error) {
            logService.error('Failed to save cache to storage', error);
            throw error;
        }
    }

    getSize() {
        return this.cache.size;
    }

    getStats() {
        const stats = {
            size: this.cache.size,
            expired: 0,
            active: 0
        };

        this.cache.forEach(item => {
            if (this.isExpired(item)) {
                stats.expired++;
            } else {
                stats.active++;
            }
        });

        return stats;
    }
}

// Create and export singleton instance
export const cacheService = new CacheService(); 