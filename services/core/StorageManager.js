import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

const STORAGE_CONFIG = {
    MAX_ITEMS: 1000,
    MAX_ITEM_SIZE: 5242880, // 5MB
    COMPRESSION_THRESHOLD: 1048576, // 1MB
    CLEANUP_INTERVAL: 3600000, // 1 hour
    DEFAULT_TTL: 86400000 // 24 hours
};

/**
 * Manages chrome.storage operations with compression and cleanup
 * @extends BaseManager
 */
class StorageManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;
    
    /** @private */
    #cleanupInterval = null;
    
    /** @private */
    #compressionStats = {
        totalSaved: 0,
        compressionRatio: 0,
        itemsCompressed: 0
    };

    constructor(registry) {
        if (StorageManager.#instance) {
            return StorageManager.#instance;
        }
        super(registry, 'StorageManager');
        StorageManager.#instance = this;
        StorageManager._registry = registry;
        
        // Add dependencies
        this.addDependency('error');
        this.addDependency('log');
        this.addDependency('event');
    }

    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing storage manager...');
            
            // Start cleanup interval
            this.#startCleanupInterval();
            
            // Verify storage access by trying to write and read a test value
            try {
                await chrome.storage.local.set({ '_test': true });
                await chrome.storage.local.remove('_test');
            } catch (error) {
                throw new Error('Storage access verification failed: ' + error.message);
            }
            
            this.log(LogLevel.SUCCESS, '✅ Storage manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Get singleton instance
     * @returns {StorageManager}
     */
    static getInstance() {
        if (!StorageManager.#instance && StorageManager._registry) {
            StorageManager.#instance = new StorageManager(StorageManager._registry);
        }
        return StorageManager.#instance;
    }

    static setRegistry(registry) {
        StorageManager._registry = registry;
    }

    /**
     * Set storage item with optional compression
     * @param {string} key Storage key
     * @param {*} value Value to store
     * @param {Object} [options] Storage options
     * @param {number} [options.ttl] Time to live in ms
     * @param {boolean} [options.compress] Whether to compress
     */
    async set(key, value, options = {}) {
        try {
            const { ttl = STORAGE_CONFIG.DEFAULT_TTL, compress = true } = options;
            
            const data = {
                value,
                timestamp: Date.now(),
                ttl,
                compressed: false
            };

            // Check size before compression
            const size = this.#getSize(data);
            
            if (size > STORAGE_CONFIG.MAX_ITEM_SIZE) {
                throw new Error(`Item size (${size}B) exceeds maximum (${STORAGE_CONFIG.MAX_ITEM_SIZE}B)`);
            }

            // Compress if needed
            if (compress && size > STORAGE_CONFIG.COMPRESSION_THRESHOLD) {
                data.value = await this.#compress(value);
                data.compressed = true;
                
                const compressedSize = this.#getSize(data);
                this.#updateCompressionStats(size, compressedSize);
            }

            await chrome.storage.local.set({ [key]: data });
            
            this.log(LogLevel.DEBUG, `💾 Stored ${key}`, {
                size,
                compressed: data.compressed,
                ttl
            });
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                operation: 'set',
                key
            });
            throw error;
        }
    }

    /**
     * Get storage item
     * @param {string} key Storage key
     * @returns {Promise<*>} Stored value
     */
    async get(key) {
        try {
            const result = await chrome.storage.local.get(key);
            const data = result[key];
            
            if (!data) return null;

            // Check TTL
            if (this.#isExpired(data)) {
                await this.remove(key);
                return null;
            }

            // Decompress if needed
            if (data.compressed) {
                data.value = await this.#decompress(data.value);
            }

            return data.value;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                operation: 'get',
                key
            });
            throw error;
        }
    }

    /**
     * Remove storage item
     * @param {string} key Storage key
     */
    async remove(key) {
        try {
            await chrome.storage.local.remove(key);
            this.log(LogLevel.DEBUG, `🗑️ Removed ${key}`);
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                operation: 'remove',
                key
            });
            throw error;
        }
    }

    /**
     * Clear all storage
     */
    async clear() {
        try {
            await chrome.storage.local.clear();
            this.log(LogLevel.INFO, '🧹 Storage cleared');
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.HIGH, {
                operation: 'clear'
            });
            throw error;
        }
    }

    /**
     * Start cleanup interval
     * @private
     */
    #startCleanupInterval() {
        if (this.#cleanupInterval) {
            clearInterval(this.#cleanupInterval);
        }

        this.#cleanupInterval = setInterval(
            () => this.cleanup(),
            STORAGE_CONFIG.CLEANUP_INTERVAL
        );

        this.log(LogLevel.DEBUG, '🔄 Cleanup interval started');
    }

    /**
     * Clean up expired items
     */
    async cleanup() {
        try {
            const now = Date.now();
            let removed = 0;

            const data = await chrome.storage.local.get(null);
            for (const [key, item] of Object.entries(data)) {
                if (item.ttl && now - item.timestamp > item.ttl) {
                    await chrome.storage.local.remove(key);
                    removed++;
                }
            }

            if (removed > 0) {
                this.log(LogLevel.INFO, `🧹 Cleaned up ${removed} expired items`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                operation: 'cleanup'
            });
        }
    }

    /**
     * Check if item is expired
     * @private
     */
    #isExpired(data) {
        return data.timestamp + data.ttl < Date.now();
    }

    /**
     * Get size of data in bytes
     * @private
     */
    #getSize(data) {
        return new Blob([JSON.stringify(data)]).size;
    }

    /**
     * Compress data
     * @private
     */
    async #compress(data) {
        const str = JSON.stringify(data);
        const bytes = new TextEncoder().encode(str);
        const compressed = await new Response(
            new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
        ).blob();
        return await compressed.arrayBuffer();
    }

    /**
     * Decompress data
     * @private
     */
    async #decompress(data) {
        const decompressed = await new Response(
            new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
        ).blob();
        const text = await decompressed.text();
        return JSON.parse(text);
    }

    /**
     * Update compression stats
     * @private
     */
    #updateCompressionStats(originalSize, compressedSize) {
        const saved = originalSize - compressedSize;
        this.#compressionStats.totalSaved += saved;
        this.#compressionStats.itemsCompressed++;
        this.#compressionStats.compressionRatio = 
            (this.#compressionStats.totalSaved / 
             (originalSize * this.#compressionStats.itemsCompressed)) * 100;
    }

    /**
     * Get storage stats
     */
    async getStats() {
        try {
            const items = await chrome.storage.local.get(null);
            const itemCount = Object.keys(items).length;
            const totalSize = Object.values(items)
                .reduce((sum, data) => sum + this.#getSize(data), 0);

            return {
                itemCount,
                totalSize,
                compression: this.#compressionStats,
                quota: await chrome.storage.local.getBytesInUse(null)
            };
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                operation: 'getStats'
            });
            throw error;
        }
    }

    /**
     * Dispose storage manager
     */
    async dispose() {
        if (this.#cleanupInterval) {
            clearInterval(this.#cleanupInterval);
            this.#cleanupInterval = null;
        }

        await super.dispose();
    }
}

// Export both class and instance
export { StorageManager };
export const storageManager = StorageManager.getInstance(); 