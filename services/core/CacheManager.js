import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

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
    constructor() {
        super();
        this._cache = new Map();
        this._compressedCache = new Map();
        this._timeouts = {
            [CachePriority.HIGH]: 30 * 60 * 1000,    // 30 minutes
            [CachePriority.MEDIUM]: 15 * 60 * 1000,  // 15 minutes
            [CachePriority.LOW]: 5 * 60 * 1000       // 5 minutes
        };
        this._compressionThreshold = 50 * 1024; // 50KB
        this._maxSize = {
            [CachePriority.HIGH]: 10 * 1024 * 1024,  // 10MB
            [CachePriority.MEDIUM]: 5 * 1024 * 1024, // 5MB
            [CachePriority.LOW]: 2 * 1024 * 1024     // 2MB
        };
        this._stats = {
            hits: 0,
            misses: 0,
            compressionRatio: 0
        };
    }

    getCacheKey(key, context = '') {
        return `${key}_${context}`;
    }

    async set(key, value, options = {}) {
        const priority = options.priority || CachePriority.MEDIUM;
        const ttl = options.ttl || this._timeouts[priority];
        const cacheKey = this.getCacheKey(key, options.context);

        try {
            const size = this._getSize(value);
            const shouldCompress = size > this._compressionThreshold;

            const entry = {
                value: shouldCompress ? await this._compress(value) : value,
                compressed: shouldCompress,
                timestamp: Date.now(),
                ttl,
                priority,
                size
            };

            // Check size limits before storing
            await this._ensureSpace(priority, size);

            if (shouldCompress) {
                this._compressedCache.set(cacheKey, entry);
            } else {
                this._cache.set(cacheKey, entry);
            }

            console.log(`[DEBUG] 💾 Cache entry stored:`, {
                key: cacheKey,
                compressed: shouldCompress,
                size,
                priority
            });
        } catch (error) {
            console.error(`[ERROR] ❌ Cache set failed:`, error);
            throw error;
        }
    }

    async get(key, context = '') {
        const cacheKey = this.getCacheKey(key, context);
        
        try {
            // Check both caches
            const entry = this._cache.get(cacheKey) || this._compressedCache.get(cacheKey);
            
            if (!entry) {
                this._stats.misses++;
                return null;
            }

            if (Date.now() - entry.timestamp > entry.ttl) {
                this._cache.delete(cacheKey);
                this._compressedCache.delete(cacheKey);
                this._stats.misses++;
                return null;
            }

            this._stats.hits++;
            return entry.compressed ? await this._decompress(entry.value) : entry.value;
        } catch (error) {
            console.error(`[ERROR] ❌ Cache get failed:`, error);
            return null;
        }
    }

    async _compress(data) {
        const jsonString = JSON.stringify(data);
        const uint8Array = new TextEncoder().encode(jsonString);
        const compressed = await new Response(
            new Blob([uint8Array]).stream().pipeThrough(new CompressionStream('gzip'))
        ).blob();
        
        const compressedData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(compressed);
        });

        this._updateCompressionStats(jsonString.length, compressedData.length);
        return compressedData;
    }

    async _decompress(compressedData) {
        const blob = await fetch(compressedData).then(r => r.blob());
        const decompressed = await new Response(
            blob.stream().pipeThrough(new DecompressionStream('gzip'))
        ).blob();
        const text = await decompressed.text();
        return JSON.parse(text);
    }

    _getSize(data) {
        return new TextEncoder().encode(JSON.stringify(data)).length;
    }

    async _ensureSpace(priority, newSize) {
        const currentSize = this._getCurrentSize(priority);
        
        if (currentSize + newSize <= this._maxSize[priority]) {
            return;
        }

        // Remove old entries starting with lowest priority
        for (const currentPriority of Object.values(CachePriority)) {
            if (currentPriority < priority) continue;
            
            const entries = [...this._cache.entries(), ...this._compressedCache.entries()]
                .filter(([_, entry]) => entry.priority === currentPriority)
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            for (const [key, entry] of entries) {
                this._cache.delete(key);
                this._compressedCache.delete(key);
                
                if (this._getCurrentSize(priority) + newSize <= this._maxSize[priority]) {
                    return;
                }
            }
        }
    }

    _getCurrentSize(priority) {
        return [...this._cache.values(), ...this._compressedCache.values()]
            .filter(entry => entry.priority === priority)
            .reduce((total, entry) => total + entry.size, 0);
    }

    _updateCompressionStats(originalSize, compressedSize) {
        const ratio = (originalSize - compressedSize) / originalSize;
        this._stats.compressionRatio = (this._stats.compressionRatio + ratio) / 2;
    }

    getStats() {
        return {
            ...this._stats,
            cacheSize: {
                regular: this._getCurrentSize(CachePriority.MEDIUM),
                compressed: [...this._compressedCache.values()].reduce((total, entry) => total + entry.size, 0)
            },
            hitRatio: this._stats.hits / (this._stats.hits + this._stats.misses)
        };
    }

    async remove(key, context = '') {
        const cacheKey = this.getCacheKey(key, context);
        return this._cache.delete(cacheKey) || this._compressedCache.delete(cacheKey);
    }

    async clear() {
        this._cache.clear();
        this._compressedCache.clear();
        this._stats = {
            hits: 0,
            misses: 0,
            compressionRatio: 0
        };
    }

    async has(key, context = '') {
        const cacheKey = this.getCacheKey(key, context);
        return this._cache.has(cacheKey) || this._compressedCache.has(cacheKey);
    }
} 