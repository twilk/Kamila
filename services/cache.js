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
            console.error('Cache initialization error:', error);
            return false;
        }
    },

    async set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Cache get error:', error);
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
            console.error('Cache clear error:', error);
            return false;
        }
    }
}; 