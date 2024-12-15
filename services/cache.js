import { sendLogToPopup } from '../config/api.js';

const CACHE_DURATION = 4 * 60 * 1000; // 4 minuty w milisekundach

export class CacheService {
    static async get(key) {
        try {
            const result = await chrome.storage.local.get([key, `${key}_timestamp`]);
            const data = result[key];
            const timestamp = result[`${key}_timestamp`];
            
            if (!data || !timestamp) return null;
            
            // Sprawdź czy cache nie wygasł
            if (Date.now() - parseInt(timestamp) > CACHE_DURATION) {
                await this.clear(key);
                return null;
            }
            
            return data;
        } catch (error) {
            sendLogToPopup('❌ Cache read error', 'error', error.message);
            return null;
        }
    }

    static async set(key, data) {
        try {
            await chrome.storage.local.set({
                [key]: data,
                [`${key}_timestamp`]: Date.now()
            });
            return true;
        } catch (error) {
            sendLogToPopup('❌ Cache write error', 'error', error.message);
            return false;
        }
    }

    static async clear(key) {
        try {
            await chrome.storage.local.remove([key, `${key}_timestamp`]);
        } catch (error) {
            sendLogToPopup('❌ Cache clear error', 'error', error.message);
        }
    }

    static async clearAll() {
        try {
            await chrome.storage.local.clear();
        } catch (error) {
            sendLogToPopup('❌ Cache clear all error', 'error', error.message);
        }
    }
} 