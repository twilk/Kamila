import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

/**
 * Cache priority levels
 */
export const CachePriority = {
    HIGH: 1,    // Critical data, keep as long as possible
    MEDIUM: 2,  // Important data, normal TTL
    LOW: 3      // Temporary data, short TTL
};

/**
 * Optimized cache manager implementing hierarchical caching
 */
export class CacheManager extends BaseManager {
    constructor(options = {}) {
        super();
        this.memoryCache = new Map();
        this.compressionEnabled = options.compression ?? true;
        this.maxMemorySize = options.maxMemorySize ?? 50 * 1024 * 1024; // 50MB default
        this.cleanupInterval = options.cleanupInterval ?? 300000; // 5 minutes default
        this.cleanupTimer = null;
    }

    async initialize() {
        try {
            await super.initialize();
            
            // Start cleanup timer
            this.startCleanupTimer();
            
            // Initial cleanup of expired items
            await this.cleanup();
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    startCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
    }

    async get(key) {
        try {
            // Try memory cache first
            const memoryData = this.memoryCache.get(key);
            if (memoryData && !this.isExpired(memoryData)) {
                this.emit('cacheHit', { key, source: 'memory' });
                return memoryData.value;
            }

            // Try storage cache
            const storageData = await chrome.storage.local.get(key);
            if (storageData[key] && !this.isExpired(storageData[key])) {
                // Cache hit in storage, move to memory if high priority
                if (storageData[key].priority === CachePriority.HIGH) {
                    this.memoryCache.set(key, storageData[key]);
                }
                this.emit('cacheHit', { key, source: 'storage' });
                return storageData[key].value;
            }

            this.emit('cacheMiss', { key });
            return null;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.WARNING, {
                method: 'get',
                key
            });
            return null;
        }
    }

    async set(key, value, options = {}) {
        try {
            const cacheEntry = {
                value,
                expires: Date.now() + (options.ttl ?? 300000),
                priority: options.priority ?? CachePriority.MEDIUM,
                compressed: false,
                updated: Date.now()
            };

            // Compress if enabled and data is large
            if (options.compression && this.compressionEnabled) {
                const size = this.getObjectSize(value);
                if (size > 1024) { // Compress if larger than 1KB
                    cacheEntry.value = await this.compress(value);
                    cacheEntry.compressed = true;
                }
            }

            // Store in memory if high priority or small size
            if (cacheEntry.priority === CachePriority.HIGH || this.getObjectSize(cacheEntry) < 1024) {
                this.memoryCache.set(key, cacheEntry);
            }

            // Store in storage if persistent or medium/high priority
            if (options.persistent || cacheEntry.priority <= CachePriority.MEDIUM) {
                await chrome.storage.local.set({ [key]: cacheEntry });
            }

            this.emit('cacheSet', { key, size: this.getObjectSize(cacheEntry) });
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.ERROR, {
                method: 'set',
                key
            });
            return false;
        }
    }

    isExpired(entry) {
        return entry.expires && Date.now() > entry.expires;
    }

    async cleanup() {
        try {
            const now = Date.now();

            // Cleanup memory cache
            for (const [key, entry] of this.memoryCache.entries()) {
                if (this.isExpired(entry)) {
                    this.memoryCache.delete(key);
                }
            }

            // Cleanup storage cache
            const all = await chrome.storage.local.get(null);
            const expiredKeys = Object.entries(all)
                .filter(([_, value]) => this.isExpired(value))
                .map(([key]) => key);

            if (expiredKeys.length > 0) {
                await chrome.storage.local.remove(expiredKeys);
            }

            // Check memory usage
            await this.checkMemoryUsage();

            this.emit('cleanup', { 
                expiredCount: expiredKeys.length,
                memorySize: this.getMemoryCacheSize()
            });
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.WARNING, {
                method: 'cleanup'
            });
        }
    }

    async checkMemoryUsage() {
        const currentSize = this.getMemoryCacheSize();
        if (currentSize > this.maxMemorySize) {
            // Remove low priority items first
            for (const [key, entry] of this.memoryCache.entries()) {
                if (entry.priority === CachePriority.LOW) {
                    this.memoryCache.delete(key);
                }
            }

            // If still too large, remove medium priority items
            if (this.getMemoryCacheSize() > this.maxMemorySize) {
                for (const [key, entry] of this.memoryCache.entries()) {
                    if (entry.priority === CachePriority.MEDIUM) {
                        this.memoryCache.delete(key);
                    }
                }
            }
        }
    }

    getMemoryCacheSize() {
        return Array.from(this.memoryCache.entries())
            .reduce((size, [key, value]) => size + key.length + this.getObjectSize(value), 0);
    }

    getObjectSize(obj) {
        return new TextEncoder().encode(JSON.stringify(obj)).length;
    }

    async compress(data) {
        const jsonString = JSON.stringify(data);
        const uint8Array = new TextEncoder().encode(jsonString);
        const compressed = await new Response(
            new Blob([uint8Array]).stream().pipeThrough(new CompressionStream('gzip'))
        ).blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(compressed);
        });
    }

    async decompress(compressedData) {
        const blob = await fetch(compressedData).then(r => r.blob());
        const decompressed = await new Response(
            blob.stream().pipeThrough(new DecompressionStream('gzip'))
        ).blob();
        const text = await decompressed.text();
        return JSON.parse(text);
    }

    async clear(pattern) {
        try {
            if (pattern) {
                // Clear pattern-matched items from memory
                for (const key of this.memoryCache.keys()) {
                    if (key.includes(pattern)) {
                        this.memoryCache.delete(key);
                    }
                }

                // Clear pattern-matched items from storage
                const all = await chrome.storage.local.get(null);
                const matchedKeys = Object.keys(all).filter(key => key.includes(pattern));
                await chrome.storage.local.remove(matchedKeys);
            } else {
                // Clear all
                this.memoryCache.clear();
                await chrome.storage.local.clear();
            }

            this.emit('cacheClear', { pattern });
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.ERROR, {
                method: 'clear',
                pattern
            });
            return false;
        }
    }

    async dispose() {
        try {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
            this.memoryCache.clear();
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.CACHE, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 