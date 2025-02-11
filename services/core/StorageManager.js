import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { 
    STORAGE_KEYS,
    QUOTA_WARNING_THRESHOLD,
    QUOTA_CRITICAL_THRESHOLD,
    CLEANUP_BATCH_SIZE,
    LOCK_TIMEOUT
} from '../../config/storage.js';
import { BaseManager } from './BaseManager.js';

// Stałe dla buforowania
const BUFFER_SIZE = 100;
const BUFFER_FLUSH_INTERVAL = 1000; // 1 sekunda
const WRITE_BATCH_SIZE = 20;

// Helper function to get storage info
async function getStorageInfo() {
    try {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const { quotaBytes } = await chrome.storage.local.get('quotaBytes') || { quotaBytes: chrome.storage.local.QUOTA_BYTES };
        return { bytesInUse, quotaBytes };
    } catch (error) {
        console.error('[ERROR] ❌ Error getting storage info:', error);
        throw error;
    }
}

export class StorageManager extends BaseManager {
    static #instance = null;
    #locks = new Map();
    #pendingOperations = new Map();
    #writeBuffer = new Map();
    #flushTimer = null;
    #batchPromises = new Map();

    constructor() {
        super('StorageManager');
        if (StorageManager.#instance) {
            return StorageManager.#instance;
        }
        StorageManager.#instance = this;
        this.#initializeBuffer();
    }

    /**
     * Initialize write buffer and flush timer
     * @private
     */
    #initializeBuffer() {
        this.#flushTimer = setInterval(() => {
            this.#flushBuffer();
        }, BUFFER_FLUSH_INTERVAL);
    }

    /**
     * Flush write buffer to storage
     * @private
     */
    async #flushBuffer() {
        if (this.#writeBuffer.size === 0) return;

        try {
            const entries = Array.from(this.#writeBuffer.entries());
            const batches = [];
            
            // Split into batches
            for (let i = 0; i < entries.length; i += WRITE_BATCH_SIZE) {
                const batch = entries.slice(i, i + WRITE_BATCH_SIZE);
                batches.push(Object.fromEntries(batch));
            }

            // Process batches
            for (const batch of batches) {
                await chrome.storage.local.set(batch);
            }

            // Clear processed entries
            entries.forEach(([key]) => this.#writeBuffer.delete(key));

            this.log('✅ Buffer flushed successfully', {
                entriesCount: entries.length,
                batchesCount: batches.length
            });
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.HIGH, {
                method: '#flushBuffer',
                bufferSize: this.#writeBuffer.size
            });
        }
    }

    /**
     * Get singleton instance
     * @returns {StorageManager}
     */
    static getInstance() {
        if (!StorageManager.#instance) {
            StorageManager.#instance = new StorageManager();
        }
        return StorageManager.#instance;
    }

    /**
     * Initialize storage manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log('🔄 Initializing storage manager...');
            
            // Check storage quota
            const { bytesInUse, quotaBytes } = await getStorageInfo();
            const usageRatio = bytesInUse / quotaBytes;

            if (usageRatio > QUOTA_CRITICAL_THRESHOLD) {
                await this.cleanup();
            }

            this.log('✅ Storage manager initialized successfully', {
                bytesInUse,
                quotaBytes,
                usageRatio: (usageRatio * 100).toFixed(2) + '%'
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Get a value from storage with caching
     * @param {string} key Storage key
     * @returns {Promise<any>} Stored value
     */
    async get(key) {
        try {
            // Check write buffer first
            if (this.#writeBuffer.has(key)) {
                return this.#writeBuffer.get(key);
            }

            // Check pending operations
            const pendingOp = this.#pendingOperations.get(key);
            if (pendingOp) {
                return pendingOp;
            }

            const promise = chrome.storage.local.get(key)
                .then(result => result[key]);

            // Cache the promise
            this.#pendingOperations.set(key, promise);

            const value = await promise;
            this.#pendingOperations.delete(key);

            return value;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM);
            return null;
        }
    }

    /**
     * Set a value in storage with buffering
     * @param {string} key Storage key
     * @param {any} value Value to store
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value) {
        try {
            await this.#acquireLock(key);

            // Add to write buffer
            this.#writeBuffer.set(key, value);

            // Flush if buffer is full
            if (this.#writeBuffer.size >= BUFFER_SIZE) {
                await this.#flushBuffer();
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM);
            return false;
        } finally {
            this.#releaseLock(key);
        }
    }

    /**
     * Batch set multiple values
     * @param {Object} entries Key-value pairs to store
     * @returns {Promise<boolean>} Success status
     */
    async setBatch(entries) {
        try {
            const keys = Object.keys(entries);
            await Promise.all(keys.map(key => this.#acquireLock(key)));

            const batchId = Date.now().toString();
            const promise = (async () => {
                try {
                    // Add all entries to write buffer
                    Object.entries(entries).forEach(([key, value]) => {
                        this.#writeBuffer.set(key, value);
                    });

                    // Flush if buffer is full
                    if (this.#writeBuffer.size >= BUFFER_SIZE) {
                        await this.#flushBuffer();
                    }

                    return true;
                } finally {
                    keys.forEach(key => this.#releaseLock(key));
                    this.#batchPromises.delete(batchId);
                }
            })();

            this.#batchPromises.set(batchId, promise);
            return await promise;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Remove a value from storage
     * @param {string} key Storage key
     * @returns {Promise<boolean>} Success status
     */
    async remove(key) {
        try {
            await this.#acquireLock(key);
            await chrome.storage.local.remove(key);
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW);
            return false;
        } finally {
            this.#releaseLock(key);
        }
    }

    /**
     * Clear all storage
     * @returns {Promise<boolean>} Success status
     */
    async clear() {
        try {
            await chrome.storage.local.clear();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Clean up storage when approaching quota
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            this.log('🧹 Starting storage cleanup...');
            
            const { bytesInUse, quotaBytes } = await getStorageInfo();
            if (bytesInUse / quotaBytes <= QUOTA_WARNING_THRESHOLD) {
                this.log('✅ Storage cleanup not needed');
                return;
            }

            // Get all keys and their last access time
            const allData = await chrome.storage.local.get(null);
            const entries = Object.entries(allData)
                .filter(([key]) => !this.#isProtectedKey(key))
                .map(([key, value]) => ({
                    key,
                    lastAccess: value?.timestamp || 0,
                    size: JSON.stringify(value).length
                }))
                .sort((a, b) => a.lastAccess - b.lastAccess);

            // Remove oldest entries until under warning threshold
            let removedCount = 0;
            for (const entry of entries) {
                if (bytesInUse / quotaBytes <= QUOTA_WARNING_THRESHOLD) break;
                
                await this.remove(entry.key);
                bytesInUse -= entry.size;
                removedCount++;

                if (removedCount >= CLEANUP_BATCH_SIZE) {
                    this.log('⚠️ Reached cleanup batch limit');
                    break;
                }
            }

            this.log('✅ Storage cleanup completed', { removedCount });
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.HIGH);
        }
    }

    /**
     * Check if a key is protected from cleanup
     * @private
     */
    #isProtectedKey(key) {
        const protectedKeys = [
            STORAGE_KEYS.SELECTED_STORE,
            STORAGE_KEYS.SELECTED_USER,
            STORAGE_KEYS.DEBUG_MODE,
            STORAGE_KEYS.LANGUAGE
        ];
        return protectedKeys.includes(key);
    }

    /**
     * Acquire a lock for a key
     * @private
     */
    async #acquireLock(key) {
        const start = Date.now();
        while (this.#locks.has(key)) {
            if (Date.now() - start > LOCK_TIMEOUT) {
                throw new Error(`Lock timeout for key: ${key}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.#locks.set(key, Date.now());
    }

    /**
     * Release a lock for a key
     * @private
     */
    #releaseLock(key) {
        this.#locks.delete(key);
    }

    /**
     * Dispose storage manager
     */
    async dispose() {
        try {
            // Clear flush timer
            if (this.#flushTimer) {
                clearInterval(this.#flushTimer);
                this.#flushTimer = null;
            }

            // Flush remaining buffer
            await this.#flushBuffer();

            // Wait for pending operations
            await Promise.all([
                ...this.#pendingOperations.values(),
                ...this.#batchPromises.values()
            ]);

            // Clear maps
            this.#writeBuffer.clear();
            this.#pendingOperations.clear();
            this.#batchPromises.clear();
            this.#locks.clear();

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSE, ErrorSeverity.HIGH);
        }
    }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();

// Re-export storage keys for backward compatibility
export { STORAGE_KEYS }; 