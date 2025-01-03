import { logService } from './LogService.js';

class CacheManagerService {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
        logService.info('CacheManagerService constructed');
    }

    async initialize() {
        try {
            logService.info('Initializing CacheManagerService...');
            this.initialized = true;
            logService.info('CacheManagerService initialized successfully');
            return true;
        } catch (error) {
            logService.error('Failed to initialize CacheManagerService:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const item = this.cache.get(key);
            if (!item) return null;

            const { value, timestamp, ttl } = item;
            const now = Date.now();

            if (now - timestamp > ttl) {
                this.cache.delete(key);
                logService.debug('Cache item expired:', { key });
                return null;
            }

            logService.debug('Cache hit:', { key });
            return value;
        } catch (error) {
            logService.error('Failed to get cache item:', {
                error: error.message,
                stack: error.stack,
                key
            });
            return null;
        }
    }

    async set(key, value, ttl = this.defaultTTL) {
        try {
            this.cache.set(key, {
                value,
                timestamp: Date.now(),
                ttl
            });
            logService.debug('Cache item set:', { key, ttl });
            return true;
        } catch (error) {
            logService.error('Failed to set cache item:', {
                error: error.message,
                stack: error.stack,
                key
            });
            return false;
        }
    }

    async delete(key) {
        try {
            const deleted = this.cache.delete(key);
            logService.debug('Cache item deleted:', { key, success: deleted });
            return deleted;
        } catch (error) {
            logService.error('Failed to delete cache item:', {
                error: error.message,
                stack: error.stack,
                key
            });
            return false;
        }
    }

    async clear() {
        try {
            this.cache.clear();
            logService.debug('Cache cleared');
            return true;
        } catch (error) {
            logService.error('Failed to clear cache:', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    async has(key) {
        return this.cache.has(key);
    }

    async keys() {
        return Array.from(this.cache.keys());
    }

    async size() {
        return this.cache.size;
    }

    cleanup() {
        this.cache.clear();
        this.initialized = false;
        logService.debug('CacheManagerService cleaned up');
    }
}

export const cacheManagerService = new CacheManagerService(); 