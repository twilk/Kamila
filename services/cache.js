import { CACHE_CONFIG } from '../config/cache.config.js';
import { performanceMonitor } from './performance.js';
import { NotificationService } from './notification.service.js';

export class CacheService {
    static _getDataSize(data) {
        const str = JSON.stringify(data);
        return new Blob([str]).size;
    }

    static async _checkTotalSize() {
        const all = await chrome.storage.local.get(null);
        let totalSize = 0;

        for (const entry of Object.values(all)) {
            if (entry.size) {
                totalSize += entry.size;
            }
        }

        if (totalSize > CACHE_CONFIG.MAX_SIZE_MB * 1024 * 1024) {
            throw new Error('Cache size limit exceeded');
        }

        return totalSize;
    }

    static async set(key, data, timeout = CACHE_CONFIG.DEFAULT_TIMEOUT) {
        performanceMonitor.startMeasure('cache-write');
        
        try {
            // Sprawdź rozmiar danych przed zapisem
            const dataSize = this._getDataSize(data);
            if (dataSize > CACHE_CONFIG.MAX_SIZE_MB * 1024 * 1024) {
                throw new Error('Cache entry too large');
            }

            // Sprawdź całkowity rozmiar cache
            await this._checkTotalSize();

            const entry = {
                data,
                timestamp: Date.now(),
                expires: Date.now() + timeout,
                size: dataSize
            };

            const writeStart = performance.now();
            await chrome.storage.local.set({ [key]: entry });
            const writeTime = performance.now() - writeStart;

            // Monitoruj czas zapisu
            if (writeTime > CACHE_CONFIG.THRESHOLDS.WRITE_TIME) {
                await NotificationService.notify({
                    title: i18n.translate('notifications.cache.slowWrite.title'),
                    message: i18n.translate('notifications.cache.slowWrite.message', {
                        time: Math.round(writeTime)
                    }),
                    type: 'warning'
                });
            }

            performanceMonitor.endMeasure('cache-write');
            return true;
        } catch (error) {
            console.error('Cache write error:', error);
            performanceMonitor.endMeasure('cache-write');
            
            await NotificationService.notify({
                title: i18n.translate('notifications.cache.error.title'),
                message: error.message,
                type: 'error'
            });
            
            return false;
        }
    }

    static async get(key) {
        performanceMonitor.startMeasure('cache-read');
        
        try {
            const readStart = performance.now();
            const result = await chrome.storage.local.get(key);
            const readTime = performance.now() - readStart;

            // Monitoruj czas odczytu
            if (readTime > CACHE_CONFIG.THRESHOLDS.READ_TIME) {
                console.warn(`Slow cache read: ${readTime}ms`);
            }

            const entry = result[key];
            if (!entry) {
                performanceMonitor.endMeasure('cache-read');
                return null;
            }

            // Check if expired
            if (Date.now() > entry.expires) {
                await this.invalidate(key);
                performanceMonitor.endMeasure('cache-read');
                return null;
            }

            // Random force refresh
            if (Math.random() < CACHE_CONFIG.INVALIDATION.FORCE_REFRESH_PROBABILITY) {
                await this.invalidate(key);
                performanceMonitor.endMeasure('cache-read');
                return null;
            }

            performanceMonitor.endMeasure('cache-read');
            return entry.data;
        } catch (error) {
            console.error('Cache read error:', error);
            performanceMonitor.endMeasure('cache-read');
            return null;
        }
    }

    static async invalidate(key) {
        try {
            await chrome.storage.local.remove(key);
            return true;
        } catch (error) {
            console.error('Cache invalidation error:', error);
            return false;
        }
    }

    static async cleanup() {
        performanceMonitor.startMeasure('cache-cleanup');
        
        try {
            const all = await chrome.storage.local.get(null);
            const now = Date.now();
            const toRemove = [];
            let totalSize = 0;

            for (const [key, entry] of Object.entries(all)) {
                if (entry.expires && entry.expires < now) {
                    toRemove.push(key);
                }
                if (entry.size) {
                    totalSize += entry.size;
                }
            }

            if (toRemove.length > 0) {
                await chrome.storage.local.remove(toRemove);
            }

            // Sprawdź całkowity rozmiar po czyszczeniu
            if (totalSize > CACHE_CONFIG.THRESHOLDS.SIZE_WARNING * 1024 * 1024) {
                await NotificationService.notify({
                    title: i18n.translate('notifications.cache.sizeWarning.title'),
                    message: i18n.translate('notifications.cache.sizeWarning.message', {
                        size: Math.round(totalSize / (1024 * 1024))
                    }),
                    type: 'warning'
                });
            }

            performanceMonitor.endMeasure('cache-cleanup');
            return toRemove.length;
        } catch (error) {
            console.error('Cache cleanup error:', error);
            performanceMonitor.endMeasure('cache-cleanup');
            return 0;
        }
    }
} 