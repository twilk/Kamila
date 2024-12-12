import { sendLogToPopup } from '../config/api.js';

export const CacheManager = {
    async init() {
        try {
            // Sprawdź czy cache jest dostępny
            if ('caches' in window) {
                // Otwórz lub stwórz cache dla aplikacji
                const cache = await caches.open('kamila-v1');
                return true;
            }
            return false;
        } catch (error) {
            sendLogToPopup('❌ Cache initialization error', 'error', error.message);
            return false;
        }
    },

    async set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            sendLogToPopup('💾 Cache updated', 'info', key);
            return true;
        } catch (error) {
            sendLogToPopup('❌ Cache set error', 'error', error.message);
            return false;
        }
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            sendLogToPopup('❌ Cache get error', 'error', error.message);
            return null;
        }
    },

    clear(key) {
        try {
            if (key) {
                localStorage.removeItem(key);
            } else {
                localStorage.clear();
            }
            return true;
        } catch (error) {
            sendLogToPopup('❌ Cache clear error', 'error', error.message);
            return false;
        }
    }
}; 