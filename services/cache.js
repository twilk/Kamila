import { storageManager } from './storage.js';

export class CacheService {
    static async isAvailable() {
        try {
            const testKey = '_cache_test_' + Date.now();
            await storageManager.save(testKey, true);
            const result = await storageManager.load(testKey);
            await storageManager.remove(testKey);
            return result !== null;
        } catch {
            return false;
        }
    }

    static async get(key) {
        try {
            const data = await storageManager.load(key);
            
            // Check if data exists and isn't expired
            if (data && data.expires) {
                if (Date.now() > data.expires) {
                    // Data expired, remove it
                    await storageManager.remove(key);
                    return null;
                }
                return data.value;
            }
            return null;
        } catch {
            return null;
        }
    }

    static async set(key, value, ttl = 300000) { // domyślnie 5 minut
        try {
            // Clear any existing data for this key
            await storageManager.remove(key);
            
            // Store new data with expiration
            await storageManager.save(key, {
                value,
                expires: Date.now() + ttl,
                updated: Date.now()
            });
            
            // Also update the leadCounts in storage for backward compatibility
            if (key.includes('counts')) {
                await storageManager.save('leadCounts', value);
                await storageManager.save('lastUpdate', Date.now());
            }
            
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    static async clear(pattern = null) {
        try {
            if (pattern) {
                const all = await storageManager.load(null);
                const keys = Object.keys(all).filter(key => key.includes(pattern));
                for (const key of keys) {
                    await storageManager.remove(key);
                }
            } else {
                await storageManager.remove(null);
            }
            return true;
        } catch {
            return false;
        }
    }
} 