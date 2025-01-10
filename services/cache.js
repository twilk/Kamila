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
            return result[key] || null;
        } catch {
            return null;
        }
    }

    static async set(key, value, ttl = 300000) { // domyślnie 5 minut
        try {
            await chrome.storage.local.set({
                [key]: {
                    value,
                    expires: Date.now() + ttl
                }
            });
            return true;
        } catch {
            return false;
        }
    }
} 