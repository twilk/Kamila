import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

/**
 * Cache priority levels
 */
export const CachePriority = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

/**
 * Optimized cache manager implementing hierarchical caching
 */
export class CacheManager extends BaseManager {
    static #instance = null;
    #cache = new Map();
    #stats = {
        hits: 0,
        misses: 0,
        compressionRatio: 0,
        size: 0
    };
    #defaultTTL = 5 * 60 * 1000; // 5 minutes

    constructor() {
        super('CacheManager');
        if (CacheManager.#instance) {
            return CacheManager.#instance;
        }
        CacheManager.#instance = this;
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
    }

    /**
     * Get singleton instance
     * @returns {CacheManager}
     */
    static getInstance() {
        if (!CacheManager.#instance) {
            CacheManager.#instance = new CacheManager();
        }
        return CacheManager.#instance;
    }

    /**
     * Initialize cache manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing cache manager...');
            
            // Initialize cache storage
            this.#cache.clear();
            this.#stats = {
                hits: 0,
                misses: 0,
                compressionRatio: 0,
                size: 0
            };

            // Try to load cached data from storage
            try {
                const data = await chrome.storage.local.get('cache_data');
                if (data.cache_data) {
                    for (const [key, value] of Object.entries(data.cache_data)) {
                        if (this.#isValid(value)) {
                            this.#cache.set(key, value);
                        }
                    }
                    this.log(LogLevel.INFO, `📦 Loaded ${this.#cache.size} cached items`);
                }
            } catch (error) {
                this.log(LogLevel.WARN, '⚠️ Failed to load cached data:', { error });
            }

            this.log(LogLevel.SUCCESS, '✅ Cache manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'onInitialize'
            });
            return false;
        }
    }

    getCacheKey(key, context = '') {
        return `${key}_${context}`;
    }

    /**
     * Set cache value
     * @param {string} key Cache key
     * @param {*} value Value to cache
     * @param {number} [ttl] Time to live in milliseconds
     */
    async set(key, value, options = {}) {
        const priority = options.priority || CachePriority.MEDIUM;
        const ttl = options.ttl || this._timeouts[priority];
        const cacheKey = this.getCacheKey(key, options.context);

        try {
            this.log(LogLevel.DEBUG, 'Setting cache entry', {
                key: cacheKey,
                priority,
                ttl
            });

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
                this.#cache.set(cacheKey, entry);
            }

            this.log(LogLevel.SUCCESS, 'Cache entry stored', {
                key: cacheKey,
                compressed: shouldCompress,
                size,
                priority
            });

            await this.#persistCache();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'set',
                key: cacheKey,
                size: size
            });
            throw error;
        }
    }

    /**
     * Get cached value
     * @param {string} key Cache key
     * @returns {*} Cached value or null if not found/expired
     */
    async get(key, context = '') {
        const cacheKey = this.getCacheKey(key, context);
        
        try {
            this.log(LogLevel.DEBUG, 'Getting cache entry', { key: cacheKey });
            
            // Check both caches
            const entry = this.#cache.get(cacheKey) || this._compressedCache.get(cacheKey);
            
            if (!entry) {
                this.#stats.misses++;
                this.log(LogLevel.INFO, 'Cache miss', { key: cacheKey });
                return null;
            }

            if (Date.now() - entry.timestamp > entry.ttl) {
                this.#cache.delete(cacheKey);
                this._compressedCache.delete(cacheKey);
                this.#stats.misses++;
                this.log(LogLevel.INFO, 'Cache entry expired', {
                    key: cacheKey,
                    age: Date.now() - entry.timestamp
                });
                return null;
            }

            this.#stats.hits++;
            this.log(LogLevel.SUCCESS, 'Cache hit', {
                key: cacheKey,
                compressed: entry.compressed,
                age: Date.now() - entry.timestamp
            });
            
            return entry.compressed ? await this._decompress(entry.value) : entry.value;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'get',
                key: cacheKey
            });
            return null;
        }
    }

    async _compress(data) {
        try {
            this.log(LogLevel.DEBUG, 'Compressing data');
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
            
            this.log(LogLevel.SUCCESS, 'Data compressed', {
                originalSize: jsonString.length,
                compressedSize: compressedData.length,
                ratio: this.#stats.compressionRatio
            });
            
            return compressedData;
        } catch (error) {
            this.handleError(error, ErrorType.COMPRESSION, ErrorSeverity.WARNING, {
                method: '_compress'
            });
            throw error;
        }
    }

    async _decompress(compressedData) {
        try {
            this.log(LogLevel.DEBUG, 'Decompressing data');
            const blob = await fetch(compressedData).then(r => r.blob());
            const decompressed = await new Response(
                blob.stream().pipeThrough(new DecompressionStream('gzip'))
            ).blob();
            const text = await decompressed.text();
            
            this.log(LogLevel.SUCCESS, 'Data decompressed', {
                compressedSize: compressedData.length,
                decompressedSize: text.length
            });
            
            return JSON.parse(text);
        } catch (error) {
            this.handleError(error, ErrorType.COMPRESSION, ErrorSeverity.WARNING, {
                method: '_decompress'
            });
            throw error;
        }
    }

    _getSize(data) {
        return new TextEncoder().encode(JSON.stringify(data)).length;
    }

    async _ensureSpace(priority, newSize) {
        try {
            const currentSize = this._getCurrentSize(priority);
            
            if (currentSize + newSize <= this._maxSize[priority]) {
                return;
            }

            this.log(LogLevel.INFO, 'Cache cleanup needed', {
                priority,
                currentSize,
                newSize,
                maxSize: this._maxSize[priority]
            });

            // Remove old entries starting with lowest priority
            for (const currentPriority of Object.values(CachePriority)) {
                if (currentPriority < priority) continue;
                
                const entries = [...this.#cache.entries(), ...this._compressedCache.entries()]
                    .filter(([_, entry]) => entry.priority === currentPriority)
                    .sort((a, b) => a[1].timestamp - b[1].timestamp);

                for (const [key, entry] of entries) {
                    this.log(LogLevel.DEBUG, 'Removing cache entry', {
                        key,
                        size: entry.size,
                        age: Date.now() - entry.timestamp
                    });
                    
                    this.#cache.delete(key);
                    this._compressedCache.delete(key);
                    
                    if (this._getCurrentSize(priority) + newSize <= this._maxSize[priority]) {
                        this.log(LogLevel.SUCCESS, 'Cache cleanup completed', {
                            removedEntries: entries.length,
                            newSize: this._getCurrentSize(priority)
                        });
                        return;
                    }
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: '_ensureSpace',
                priority,
                newSize
            });
        }
    }

    _getCurrentSize(priority) {
        return [...this.#cache.values(), ...this._compressedCache.values()]
            .filter(entry => entry.priority === priority)
            .reduce((total, entry) => total + entry.size, 0);
    }

    _updateCompressionStats(originalSize, compressedSize) {
        const ratio = (originalSize - compressedSize) / originalSize;
        this.#stats.compressionRatio = (this.#stats.compressionRatio + ratio) / 2;
    }

    getStats() {
        return {
            ...this.#stats,
            cacheSize: {
                regular: this._getCurrentSize(CachePriority.MEDIUM),
                compressed: [...this._compressedCache.values()].reduce((total, entry) => total + entry.size, 0)
            },
            hitRatio: this.#stats.hits / (this.#stats.hits + this.#stats.misses)
        };
    }

    async remove(key, context = '') {
        const cacheKey = this.getCacheKey(key, context);
        return this.#cache.delete(cacheKey) || this._compressedCache.delete(cacheKey);
    }

    /**
     * Clear cache
     * @param {string} [key] Specific key to clear, or all if not provided
     */
    async clear(key) {
        try {
            if (key) {
                this.#cache.delete(key);
            } else {
                this.#cache.clear();
            }
            
            await this.#persistCache();
            this.log(LogLevel.INFO, `🧹 Cleared cache${key ? ` for key: ${key}` : ''}`);
        } catch (error) {
            this.handleError(error, ErrorType.RUNTIME, ErrorSeverity.LOW, {
                method: 'clear',
                key
            });
        }
    }

    async has(key, context = '') {
        const cacheKey = this.getCacheKey(key, context);
        return this.#cache.has(cacheKey) || this._compressedCache.has(cacheKey);
    }

    /**
     * Check if cache entry is valid
     * @private
     */
    #isValid(entry) {
        return entry && 
               entry.timestamp && 
               entry.ttl && 
               (Date.now() - entry.timestamp) < entry.ttl;
    }

    /**
     * Persist cache to storage
     * @private
     */
    async #persistCache() {
        await chrome.storage.local.set({
            cache_data: Object.fromEntries(this.#cache)
        });
    }

    /**
     * Dispose cache manager
     */
    async dispose() {
        try {
            this.log(LogLevel.INFO, '🔄 Disposing cache manager...');
            
            this.log(LogLevel.DEBUG, 'Clearing caches');
            this.#cache.clear();
            this._compressedCache.clear();
            
            this.log(LogLevel.DEBUG, 'Resetting stats');
            this.#stats = {
                hits: 0,
                misses: 0,
                compressionRatio: 0,
                size: 0
            };
            
            await this.#persistCache();
            await chrome.storage.local.remove('cache_data');
            
            this.log(LogLevel.SUCCESS, '✅ Disposed successfully');
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSE, ErrorSeverity.MEDIUM, {
                method: 'dispose'
            });
        }
    }
}

// Create and export singleton instance
export const cacheManager = CacheManager.getInstance(); 