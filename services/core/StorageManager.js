import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { 
    STORAGE_KEYS,
    QUOTA_WARNING_THRESHOLD,
    QUOTA_CRITICAL_THRESHOLD,
    CLEANUP_BATCH_SIZE,
    LOCK_TIMEOUT
} from '../../config/storage.js';
import { BaseManager } from './BaseManager.js';

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

    constructor() {
        super('StorageManager');
        if (StorageManager.#instance) {
            return StorageManager.#instance;
        }
        StorageManager.#instance = this;
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
     * Get a value from storage
     * @param {string} key Storage key
     * @returns {Promise<any>} Stored value
     */
    async get(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key];
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM);
            return null;
        }
    }

    /**
     * Set a value in storage
     * @param {string} key Storage key
     * @param {any} value Value to store
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value) {
        try {
            await this.#acquireLock(key);
            await chrome.storage.local.set({ [key]: value });
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM);
            return false;
        } finally {
            this.#releaseLock(key);
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
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();

// Re-export storage keys for backward compatibility
export { STORAGE_KEYS }; 