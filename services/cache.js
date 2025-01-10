export class CacheService {
    static async isAvailable() {
        try {
            const testKey = '_cache_test_' + Date.now();
            await chrome.storage.local.set({ [testKey]: true });
            const result = await chrome.storage.local.get(testKey);
            await chrome.storage.local.remove(testKey);
            return !!result[testKey];
        } catch {
            return false;
        }
    }

    static async get(key) {
        try {
            const result = await chrome.storage.local.get(key);
            const data = result[key];
            
            // Check if data exists and isn't expired
            if (data && data.expires) {
                if (Date.now() > data.expires) {
                    // Data expired, remove it
                    await chrome.storage.local.remove(key);
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
            await chrome.storage.local.remove(key);
            
            // Store new data with expiration
            await chrome.storage.local.set({
                [key]: {
                    value,
                    expires: Date.now() + ttl,
                    updated: Date.now()
                }
            });
            
            // Also update the leadCounts in storage for backward compatibility
            if (key.includes('counts')) {
                await chrome.storage.local.set({
                    leadCounts: value,
                    lastUpdate: Date.now()
                });
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
                const all = await chrome.storage.local.get(null);
                const keys = Object.keys(all).filter(key => key.includes(pattern));
                await chrome.storage.local.remove(keys);
            } else {
                await chrome.storage.local.clear();
            }
            return true;
        } catch {
            return false;
        }
    }
} 