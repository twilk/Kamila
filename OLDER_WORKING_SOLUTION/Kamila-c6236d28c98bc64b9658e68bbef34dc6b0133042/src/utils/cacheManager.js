export class CacheManager {
    constructor(storage = chrome.storage.local) {
        this.storage = storage;
        this.memoryCache = new Map();
        this.defaultExpiration = 5 * 60 * 1000; // 5 minutes
    }

    async set(key, value, expiration = this.defaultExpiration) {
        const item = {
            value,
            timestamp: Date.now(),
            expiration
        };

        // Save to memory cache
        this.memoryCache.set(key, item);

        // Save to chrome storage
        try {
            await this.storage.set({ [key]: item });
        } catch (error) {
            console.error('Error saving to cache:', error);
            throw error;
        }
    }

    async get(key) {
        // Try memory cache first
        const memoryItem = this.memoryCache.get(key);
        if (memoryItem && !this.isExpired(memoryItem)) {
            return memoryItem.value;
        }

        // If not in memory or expired, try chrome storage
        try {
            const result = await this.storage.get(key);
            const item = result[key];

            if (item && !this.isExpired(item)) {
                // Update memory cache
                this.memoryCache.set(key, item);
                return item.value;
            }

            // If expired or not found, remove from both caches
            await this.remove(key);
            return null;
        } catch (error) {
            console.error('Error reading from cache:', error);
            return null;
        }
    }

    async remove(key) {
        this.memoryCache.delete(key);
        try {
            await this.storage.remove(key);
        } catch (error) {
            console.error('Error removing from cache:', error);
        }
    }

    async clear() {
        this.memoryCache.clear();
        try {
            await this.storage.clear();
        } catch (error) {
            console.error('Error clearing cache:', error);
            throw error;
        }
    }

    isExpired(item) {
        return Date.now() - item.timestamp > item.expiration;
    }

    async getOrSet(key, valueProvider, expiration = this.defaultExpiration) {
        const cachedValue = await this.get(key);
        if (cachedValue !== null) {
            return cachedValue;
        }

        const value = await valueProvider();
        await this.set(key, value, expiration);
        return value;
    }

    async invalidatePattern(pattern) {
        const keys = Array.from(this.memoryCache.keys())
            .filter(key => key.match(pattern));

        for (const key of keys) {
            await this.remove(key);
        }
    }
} 