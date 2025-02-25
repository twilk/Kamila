import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../constants.js';
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

const CACHE_CONFIG = {
    DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
    MAX_SIZE: 1000, // Maximum number of entries
    CLEANUP_INTERVAL: 60 * 1000, // 1 minute
    COMPRESSION_THRESHOLD: 1024 // 1KB
};

/**
 * Manager for optimized caching
 * @extends BaseManager
 */
class CacheManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    #store = null;
    #cleanupInterval = null;
    #cache = new Map();
    #stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0
    };

    constructor(registry) {
        if (CacheManager.#instance) {
            return CacheManager.#instance;
        }
        super(registry, 'CacheManager');
        CacheManager.#instance = this;
        CacheManager._registry = registry;
        
        this.addDependency('store');
    }

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
     * @protected
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing cache manager...');
            
            // Get dependencies
            this.#store = await this.getDependency('store');
            
            if (!this.#store?.isReady()) {
                throw new Error('Store must be ready');
            }

            // Load persisted cache
            await this.#loadPersistedCache();

            // Start cleanup interval
            this.#startCleanup();

            this.log(LogLevel.SUCCESS, '✨ Cache manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: '_initialize'
            });
            return false;
        }
    }

    /**
     * Get cached value
     * @param {string} key Cache key
     * @param {Object} [options] Cache options
     * @param {number} [options.ttl] Time to live in milliseconds
     * @returns {Promise<any>} Cached value or null
     */
    async get(key, options = {}) {
        try {
            const entry = this.#cache.get(key);
            if (!entry) {
                this.#stats.misses++;
                return null;
            }

            const now = Date.now();
            if (now - entry.timestamp > (options.ttl || CACHE_CONFIG.DEFAULT_TTL)) {
                this.#cache.delete(key);
                this.#stats.evictions++;
                this.#stats.size--;
                return null;
            }

            this.#stats.hits++;
            return this.#decompress(entry.value);
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_READ, ErrorSeverity.LOW, {
                method: 'get',
                key
            });
            return null;
        }
    }

    /**
     * Set cached value
     * @param {string} key Cache key
     * @param {any} value Value to cache
     * @param {Object} [options] Cache options
     * @param {number} [options.ttl] Time to live in milliseconds
     * @returns {Promise<void>}
     */
    async set(key, value, options = {}) {
        try {
            // Check cache size
            if (this.#cache.size >= CACHE_CONFIG.MAX_SIZE) {
                await this.#evictOldest();
            }

            // Compress if needed
            const compressed = await this.#compress(value);

            // Store in memory
            this.#cache.set(key, {
                value: compressed,
                timestamp: Date.now(),
                ttl: options.ttl || CACHE_CONFIG.DEFAULT_TTL
            });

            this.#stats.size++;

            // Persist to storage
            await this.#persistToStorage();
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_WRITE, ErrorSeverity.LOW, {
                method: 'set',
                key
            });
        }
    }

    /**
     * Delete cached value
     * @param {string} key Cache key
     * @returns {Promise<void>}
     */
    async delete(key) {
        try {
            if (this.#cache.delete(key)) {
                this.#stats.size--;
                await this.#persistToStorage();
            }
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_DELETE, ErrorSeverity.LOW, {
                method: 'delete',
                key
            });
        }
    }

    /**
     * Clear entire cache
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            this.#cache.clear();
            this.#stats.size = 0;
            this.#stats.evictions += this.#cache.size;
            await this.#persistToStorage();
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_CLEAR, ErrorSeverity.MEDIUM, {
                method: 'clear'
            });
        }
    }

    /**
     * Get cache stats
     * @returns {Object} Cache statistics
     */
    getStats() {
        return { ...this.#stats };
    }

    /**
     * Start cleanup interval
     * @private
     */
    #startCleanup() {
        if (this.#cleanupInterval) {
            clearInterval(this.#cleanupInterval);
        }

        this.#cleanupInterval = setInterval(
            () => this.#cleanup(),
            CACHE_CONFIG.CLEANUP_INTERVAL
        );
    }

    /**
     * Clean up expired entries
     * @private
     */
    async #cleanup() {
        try {
            const now = Date.now();
            let evicted = 0;

            for (const [key, entry] of this.#cache.entries()) {
                if (now - entry.timestamp > entry.ttl) {
                    this.#cache.delete(key);
                    evicted++;
                }
            }

            if (evicted > 0) {
                this.#stats.evictions += evicted;
                this.#stats.size -= evicted;
                await this.#persistToStorage();
            }
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_CLEANUP, ErrorSeverity.LOW, {
                method: '#cleanup'
            });
        }
    }

    /**
     * Evict oldest entries
     * @private
     */
    async #evictOldest() {
        try {
            const entries = Array.from(this.#cache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp);

            // Remove 10% of oldest entries
            const toRemove = Math.ceil(entries.length * 0.1);
            for (let i = 0; i < toRemove; i++) {
                const [key] = entries[i];
                this.#cache.delete(key);
                this.#stats.evictions++;
                this.#stats.size--;
            }

            await this.#persistToStorage();
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_EVICTION, ErrorSeverity.LOW, {
                method: '#evictOldest'
            });
        }
    }

    /**
     * Load persisted cache from storage
     * @private
     */
    async #loadPersistedCache() {
        try {
            const data = await this.#store.get('cache');
            if (!data) return;

            for (const [key, entry] of Object.entries(data)) {
                if (Date.now() - entry.timestamp <= entry.ttl) {
                    this.#cache.set(key, entry);
                    this.#stats.size++;
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_LOAD, ErrorSeverity.MEDIUM, {
                method: '#loadPersistedCache'
            });
        }
    }

    /**
     * Persist cache to storage
     * @private
     */
    async #persistToStorage() {
        try {
            const data = Object.fromEntries(this.#cache.entries());
            await this.#store.set('cache', data);
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_PERSIST, ErrorSeverity.MEDIUM, {
                method: '#persistToStorage'
            });
        }
    }

    /**
     * Compress value if needed
     * @private
     * @param {any} value Value to compress
     * @returns {Promise<any>} Compressed value
     */
    async #compress(value) {
        try {
            const json = JSON.stringify(value);
            if (json.length < CACHE_CONFIG.COMPRESSION_THRESHOLD) {
                return value;
            }

            const blob = new Blob([json]);
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_COMPRESSION, ErrorSeverity.LOW, {
                method: '#compress'
            });
            return value;
        }
    }

    /**
     * Decompress value if needed
     * @private
     * @param {any} value Value to decompress
     * @returns {Promise<any>} Decompressed value
     */
    async #decompress(value) {
        try {
            if (typeof value !== 'string' || !value.startsWith('data:')) {
                return value;
            }

            const response = await fetch(value);
            const blob = await response.blob();
            const text = await blob.text();
            return JSON.parse(text);
        } catch (error) {
            this.handleError(error, ErrorType.CACHE_DECOMPRESSION, ErrorSeverity.LOW, {
                method: '#decompress'
            });
            return value;
        }
    }

    /**
     * Clean up resources
     * @protected
     */
    async _dispose() {
        if (this.#cleanupInterval) {
            clearInterval(this.#cleanupInterval);
            this.#cleanupInterval = null;
        }
        await this.#persistToStorage();
        this.#cache.clear();
        this.#stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0
        };
        await super._dispose();
    }

    /**
     * Get cache manager metrics
     * @returns {Object} Metrics object
     */
    getMetrics() {
        return {
            ...super.getMetrics(),
            cache: {
                ...this.#stats,
                hitRate: this.#stats.hits / (this.#stats.hits + this.#stats.misses) || 0,
                evictionRate: this.#stats.evictions / this.#stats.size || 0
            }
        };
    }
}

// Export class only
export { CacheManager };
export const cacheManager = CacheManager.getInstance(); 