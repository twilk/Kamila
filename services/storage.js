import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { 
    STORAGE_KEYS,
    QUOTA_WARNING_THRESHOLD,
    QUOTA_CRITICAL_THRESHOLD,
    CLEANUP_BATCH_SIZE,
    LOCK_TIMEOUT
} from '../config/storage.js';
import { BaseManager } from './core/BaseManager.js';

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
    static _instance = null;

    static getInstance() {
        if (!StorageManager._instance) {
            StorageManager._instance = new StorageManager();
        }
        return StorageManager._instance;
    }

    constructor() {
        if (StorageManager._instance) {
            throw new Error('StorageManager is a singleton. Use StorageManager.getInstance() instead.');
        }
        super('StorageManager');
        StorageManager._instance = this;
        this.locks = new Map();
        this.lockTimeouts = new Map();
        this.quotaWarningEmitted = false;
    }

    /**
     * Acquire a lock for a specific operation
     * @param {string} key - The key to lock
     * @returns {Promise<boolean>} - Whether the lock was acquired
     */
    async acquireLock(key) {
        // If lock exists and hasn't timed out, return false
        const existingLock = this.locks.get(key);
        if (existingLock) {
            const timeSinceLock = Date.now() - existingLock;
            if (timeSinceLock < LOCK_TIMEOUT) {
                return false;
            }
            // If lock has timed out, release it
            this.releaseLock(key);
        }

        // Set new lock with timestamp
        this.locks.set(key, Date.now());
        
        // Set timeout to automatically release lock
        const timeoutId = setTimeout(() => {
            this.releaseLock(key);
        }, LOCK_TIMEOUT);
        
        this.lockTimeouts.set(key, timeoutId);
        return true;
    }

    /**
     * Release a lock
     * @param {string} key - The key to unlock
     */
    releaseLock(key) {
        if (this.locks.has(key)) {
            this.locks.delete(key);
            const timeoutId = this.lockTimeouts.get(key);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.lockTimeouts.delete(key);
            }
            console.debug(`[DEBUG] 🔓 Released lock for ${key}`);
        }
    }

    /**
     * Check storage quota and clean up if necessary
     * @returns {Promise<void>}
     */
    async checkQuota() {
        const { bytesInUse, quotaBytes } = await getStorageInfo();
        const usageRatio = bytesInUse / quotaBytes;

        if (usageRatio >= QUOTA_CRITICAL_THRESHOLD) {
            console.error('[ERROR] 🔥 Storage usage critical:', {
                used: bytesInUse,
                total: quotaBytes,
                ratio: usageRatio
            });
            await this.emergencyCleanup();
        } else if (usageRatio >= QUOTA_WARNING_THRESHOLD && !this.quotaWarningEmitted) {
            console.warn('[WARNING] ⚠️ Storage usage high:', {
                used: bytesInUse,
                total: quotaBytes,
                ratio: usageRatio
            });
            this.quotaWarningEmitted = true;
            await this.normalCleanup();
        } else if (usageRatio < QUOTA_WARNING_THRESHOLD) {
            this.quotaWarningEmitted = false;
        }
    }

    /**
     * Emergency cleanup when storage is critically full
     * @returns {Promise<void>}
     */
    async emergencyCleanup() {
        try {
            // Get all keys
            const allData = await chrome.storage.local.get(null);
            const keys = Object.keys(allData);
            
            // Sort keys by last access time (if available) or creation time
            const keysByAge = keys.map(key => ({
                key,
                timestamp: allData[key]?.lastAccess || allData[key]?.timestamp || 0
            })).sort((a, b) => a.timestamp - b.timestamp);

            // Remove oldest items first
            const keysToRemove = keysByAge.slice(0, CLEANUP_BATCH_SIZE).map(item => item.key);
            await chrome.storage.local.remove(keysToRemove);

            console.log('[DEBUG] 🧹 Emergency cleanup completed:', {
                removedKeys: keysToRemove.length
            });
        } catch (error) {
            console.error('[ERROR] ❌ Emergency cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Normal cleanup when storage is getting full
     * @returns {Promise<void>}
     */
    async normalCleanup() {
        try {
            const allData = await chrome.storage.local.get(null);
            const now = Date.now();
            const oldDataKeys = [];

            // Find old data (older than 30 days)
            Object.entries(allData).forEach(([key, value]) => {
                const timestamp = value?.timestamp || value?.lastAccess || 0;
                if (now - timestamp > 30 * 24 * 60 * 60 * 1000) { // 30 days
                    oldDataKeys.push(key);
                }
            });

            if (oldDataKeys.length > 0) {
                await chrome.storage.local.remove(oldDataKeys);
                console.log('[DEBUG] 🧹 Normal cleanup completed:', {
                    removedKeys: oldDataKeys.length
                });
            }
        } catch (error) {
            console.error('[ERROR] ❌ Normal cleanup failed:', error);
            // Don't throw error for normal cleanup
        }
    }

    /**
     * Save data to storage with quota check and locking
     * @param {string} key - Storage key
     * @param {any} data - Data to save
     * @returns {Promise<void>}
     */
    async save(key, data) {
        try {
            // Try to acquire lock
            if (!await this.acquireLock(key)) {
                throw new Error('Storage operation in progress', {
                    type: ErrorType.STORAGE_ERROR,
                    severity: ErrorSeverity.WARNING
                });
            }

            // Check quota before saving
            await this.checkQuota();

            // Add metadata
            const dataWithMeta = {
                value: data,
                timestamp: Date.now(),
                lastAccess: Date.now()
            };

            // Save data
            await chrome.storage.local.set({ [key]: dataWithMeta });

        } catch (error) {
            console.error(`[ERROR] ❌ Error saving to storage (${key}):`, error);
            throw error;
        } finally {
            this.releaseLock(key);
        }
    }

    /**
     * Load data from storage with access time update
     * @param {string} key - Storage key
     * @returns {Promise<any>} - Retrieved data
     */
    async load(key) {
        try {
            const result = await chrome.storage.local.get(key);
            const storedData = result[key];
            
            if (!storedData) {
                return null;
            }

            // Update last access time
            if (storedData.timestamp) {
                storedData.lastAccess = Date.now();
                await chrome.storage.local.set({ [key]: storedData });
            }

            // Return the actual data value, not the metadata wrapper
            return storedData.hasOwnProperty('value') ? storedData.value : storedData;
        } catch (error) {
            console.warn(`[WARNING] ⚠️ Error loading from storage (${key}):`, error);
            return null;
        }
    }

    /**
     * Remove data from storage
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    async remove(key) {
        try {
            // Try to acquire lock
            if (!await this.acquireLock(key)) {
                throw new Error('Storage operation in progress', {
                    type: ErrorType.STORAGE_ERROR,
                    severity: ErrorSeverity.WARNING
                });
            }

            await chrome.storage.local.remove(key);
        } catch (error) {
            console.error(`[ERROR] ❌ Error removing from storage (${key}):`, error);
            throw error;
        } finally {
            this.releaseLock(key);
        }
    }

    /**
     * Get all storage keys
     * @returns {Promise<string[]>} List of all storage keys
     */
    async keys() {
        try {
            const allData = await chrome.storage.local.get(null);
            return Object.keys(allData);
        } catch (error) {
            console.error('[ERROR] ❌ Error getting storage keys:', error);
            return [];
        }
    }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();

// Re-export storage keys for backward compatibility
export { STORAGE_KEYS }; 