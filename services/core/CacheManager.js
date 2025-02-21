import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
// import { managers } from './managers.js';
import { 
    CacheLimits,
    EndpointTTL,
    CachePriorities,
    CompressionConfig,
    CleanupConfig
} from '../../config/cache.js';

/**
 * Cache priority levels
 */
export const CachePriority = CachePriorities;

/**
 * Optimized cache manager implementing hierarchical caching
 */
class CacheManager extends BaseManager {
    /** @private */
    static #instance = null;
    
    /** @private */
    #cache = new Map();
    
    /** @private */
    #endpointSizes = new Map();
    
    /** @private */
    #stats = {
        hits: 0,
        misses: 0,
        compressionRatio: 0,
        size: 0,
        endpointSizes: new Map()
    };
    
    /** @private */
    #defaultTTL = 5 * 60 * 1000; // 5 minutes
    
    /** @private */
    #timeouts = {
        [CachePriority.HIGH]: 30 * 60 * 1000,    // 30 minutes
        [CachePriority.MEDIUM]: 15 * 60 * 1000,  // 15 minutes
        [CachePriority.LOW]: 5 * 60 * 1000       // 5 minutes
    };
    
    /** @private */
    #compressionThreshold = CompressionConfig.threshold || 50 * 1024; // 50KB
    
    /** @private */
    #maxSize = CacheLimits.memory;
    
    /** @private */
    #maxEndpointSize = CacheLimits.perEndpoint;
    
    /** @private */
    #compressedCache = new Map();

    /** @private */
    #cleanupInterval = null;

    // Private method declarations
    // #persistCache = undefined;
    // #compress = undefined;
    // #decompress = undefined;
    // #getSize = undefined;
    // #ensureSpace = undefined;
    // #getCurrentSize = undefined;
    // #updateCompressionStats = undefined;
    // #cleanupEndpoint = undefined;
    // #getEndpointFromKey = undefined;

    constructor(registry) {
        if (CacheManager.#instance) {
            return CacheManager.#instance;
        }
        super(registry, 'CacheManager');
        CacheManager.#instance = this;
    }

    /**
     * Get singleton instance
     * @returns {CacheManager}
     */
    static getInstance() {
        if (!CacheManager.#instance && CacheManager._registry) {
            CacheManager.#instance = new CacheManager(CacheManager._registry);
        }
        return CacheManager.#instance;
    }

    static setRegistry(registry) {
        CacheManager._registry = registry;
    }

    /**
     * Initialize cache manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing cache manager...');
            
            // Get storage dependency
            const storage = await this.getDependency('storage');
            if (!storage?.isInitialized()) {
                throw new Error('Storage manager must be initialized');
            }

            // Initialize cache storage
            await this.clearAll();
            
            // Start cleanup interval
            this.cleanup();
            
            this.log(LogLevel.SUCCESS, '✅ Cache manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Cleanup expired cache entries
     * @private
     */
    #cleanup = async () => {
        try {
            this.log(LogLevel.DEBUG, '🧹 Starting cache cleanup...');
            
            const now = Date.now();
            let cleanedEntries = 0;
            
            // Cleanup regular cache
            for (const [key, entry] of this.#cache.entries()) {
                if (now - entry.timestamp > entry.ttl) {
                    this.#cache.delete(key);
                    cleanedEntries++;
                }
            }
            
            // Cleanup compressed cache
            for (const [key, entry] of this.#compressedCache.entries()) {
                if (now - entry.timestamp > entry.ttl) {
                    this.#compressedCache.delete(key);
                    cleanedEntries++;
                }
            }
            
            if (cleanedEntries > 0) {
                this.log(LogLevel.INFO, `🧹 Cleaned up ${cleanedEntries} expired entries`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_CLEANUP, ErrorSeverity.LOW, {
                method: '#cleanup'
            });
        }
    };

    getCacheKey(key, context = '') {
        return `${key}_${context}`;
    }

    /**
     * Set cache value
     * @param {string} key Cache key
     * @param {*} value Value to cache
     * @param {Object} options Cache options
     */
    async set(key, value, options = {}) {
        const priority = options.priority || CachePriority.MEDIUM;
        const ttl = options.ttl || this.#timeouts[priority];
        const endpoint = this._getEndpointFromKey(key);
        const cacheKey = this.getCacheKey(key, options.context);

        try {
            this.log(LogLevel.DEBUG, 'Setting cache entry', {
                key: cacheKey,
                priority,
                ttl,
                endpoint
            });

            const size = this._getSize(value);
            const shouldCompress = size > this.#compressionThreshold;

            // Check endpoint size limit
            const endpointLimit = this.#maxEndpointSize[endpoint] || this.#maxEndpointSize.default;
            const currentEndpointSize = this.#endpointSizes.get(endpoint) || 0;
            
            if (currentEndpointSize + size > endpointLimit) {
                await this._cleanupEndpoint(endpoint, size);
            }

            const entry = {
                value: shouldCompress ? await this._compress(value) : value,
                compressed: shouldCompress,
                timestamp: Date.now(),
                ttl,
                priority,
                size,
                endpoint
            };

            // Check total size limits before storing
            await this._ensureSpace(priority, size);

            if (shouldCompress) {
                this.#compressedCache.set(cacheKey, entry);
            } else {
                this.#cache.set(cacheKey, entry);
            }

            // Update endpoint size
            this.#endpointSizes.set(endpoint, (this.#endpointSizes.get(endpoint) || 0) + size);
            this.#stats.endpointSizes.set(endpoint, this.#endpointSizes.get(endpoint));

            this.log(LogLevel.SUCCESS, 'Cache entry stored', {
                key: cacheKey,
                compressed: shouldCompress,
                size,
                priority,
                endpoint,
                endpointSize: this.#endpointSizes.get(endpoint)
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
            const entry = this.#cache.get(cacheKey) || this.#compressedCache.get(cacheKey);
            
            if (!entry) {
                this.#stats.misses++;
                this.log(LogLevel.INFO, 'Cache miss', { key: cacheKey });
                return null;
            }

            if (Date.now() - entry.timestamp > entry.ttl) {
                this.#cache.delete(cacheKey);
                this.#compressedCache.delete(cacheKey);
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

    /**
     * Compress data
     * @private
     */
    #compress = async (data) => {
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
                method: '#compress'
            });
            throw error;
        }
    };

    /**
     * Decompress data
     * @private
     */
    #decompress = async (compressedData) => {
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
                method: '#decompress'
            });
            throw error;
        }
    };

    /**
     * Get size of data in bytes
     * @private
     */
    #getSize = (data) => {
        return new TextEncoder().encode(JSON.stringify(data)).length;
    };

    /**
     * Ensure space for new cache entry
     * @private
     */
    #ensureSpace = async (priority, newSize) => {
        const currentSize = this._getCurrentSize(priority);
        
        if (currentSize + newSize <= this.#maxSize[priority]) {
            return;
        }

        this.log(LogLevel.INFO, 'Cache cleanup needed', {
            priority,
            currentSize,
            newSize,
            maxSize: this.#maxSize[priority]
        });

        // Remove old entries starting with lowest priority
        for (const currentPriority of Object.values(CachePriority)) {
            if (currentPriority < priority) continue;
            
            const entries = [...this.#cache.entries(), ...this.#compressedCache.entries()]
                .filter(([_, entry]) => entry.priority === currentPriority)
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            for (const [key, entry] of entries) {
                this.log(LogLevel.DEBUG, 'Removing cache entry', {
                    key,
                    size: entry.size,
                    age: Date.now() - entry.timestamp
                });
                
                this.#cache.delete(key);
                this.#compressedCache.delete(key);
                
                if (this._getCurrentSize(priority) + newSize <= this.#maxSize[priority]) {
                    this.log(LogLevel.SUCCESS, 'Cache cleanup completed', {
                        removedEntries: entries.length,
                        newSize: this._getCurrentSize(priority)
                    });
                    return;
                }
            }
        }
    };

    /**
     * Get current cache size
     * @private
     */
    #getCurrentSize = (priority) => {
        return [...this.#cache.values(), ...this.#compressedCache.values()]
            .filter(entry => entry.priority === priority)
            .reduce((total, entry) => total + entry.size, 0);
    };

    /**
     * Update compression stats
     * @private
     */
    #updateCompressionStats = (originalSize, compressedSize) => {
        const ratio = (originalSize - compressedSize) / originalSize;
        this.#stats.compressionRatio = (this.#stats.compressionRatio + ratio) / 2;
    };

    getStats() {
        return {
            ...this.#stats,
            cacheSize: {
                regular: this._getCurrentSize(CachePriority.MEDIUM),
                compressed: [...this.#compressedCache.values()].reduce((total, entry) => total + entry.size, 0)
            },
            hitRatio: this.#stats.hits / (this.#stats.hits + this.#stats.misses)
        };
    }

    async remove(key, context = '') {
        const cacheKey = this.getCacheKey(key, context);
        return this.#cache.delete(cacheKey) || this.#compressedCache.delete(cacheKey);
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
        return this.#cache.has(cacheKey) || this.#compressedCache.has(cacheKey);
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
    #persistCache = async () => {
        try {
            await chrome.storage.local.set({
                cache_data: Object.fromEntries(this.#cache)
            });
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '#persistCache'
            });
        }
    };

    /**
     * Dispose cache manager
     */
    async dispose() {
        try {
            this.log(LogLevel.INFO, '🔄 Disposing cache manager...');
            
            this.log(LogLevel.DEBUG, 'Clearing caches');
            this.#cache.clear();
            this.#compressedCache.clear();
            
            this.log(LogLevel.DEBUG, 'Resetting stats');
            this.#stats = {
                hits: 0,
                misses: 0,
                compressionRatio: 0,
                size: 0,
                endpointSizes: new Map()
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

    /**
     * Clean up endpoint cache to make space
     * @private
     * @param {string} endpoint Endpoint path
     * @param {number} requiredSize Required size in bytes
     */
    #cleanupEndpoint = async (endpoint, requiredSize) => {
        const entries = [...this.#cache.entries(), ...this.#compressedCache.entries()]
            .filter(([_, entry]) => entry.endpoint === endpoint)
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        let freedSpace = 0;
        for (const [key, entry] of entries) {
            if (freedSpace >= requiredSize) break;

            this.#cache.delete(key);
            this.#compressedCache.delete(key);
            freedSpace += entry.size;
            
            this.#endpointSizes.set(endpoint, (this.#endpointSizes.get(endpoint) || 0) - entry.size);
            this.#stats.endpointSizes.set(endpoint, this.#endpointSizes.get(endpoint));
        }
    };

    /**
     * Get endpoint from cache key
     * @private
     */
    #getEndpointFromKey = (key) => {
        const match = key.match(/^api:(\/.+?)(?:[/?]|$)/);
        return match ? match[1] : 'default';
    };

    /**
     * Clears all cached data
     */
    clearAll() {
        try {
            this.#cache.clear();
            this.#compressedCache.clear();
            this.#endpointSizes.clear();
            this.#stats.size = 0;
            this.#stats.endpointSizes.clear();
            this.log('Cache cleared successfully', LogLevel.INFO);
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_CLEAR_ERROR, ErrorSeverity.MEDIUM);
            return false;
        }
    }

    /**
     * Clean up cache data
     * @private
     */
    cleanup() {
        try {
            // Clear all cached data
            this.#cache.clear();
            this.#compressedCache.clear();
            this.#endpointSizes.clear();
            this.#stats.size = 0;
            this.#stats.endpointSizes.clear();
            this.log(LogLevel.INFO, '🧹 Cache cleanup completed');
        } catch (error) {
            this.handleError(error, ErrorType.CLEANUP, ErrorSeverity.LOW, {
                method: 'cleanup'
            });
        }
    }
}

// Export both class and instance
export { CacheManager };
export const cacheManager = CacheManager.getInstance(); 