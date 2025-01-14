// Storage configuration constants
export const STORAGE_KEYS = {
    CACHE: 'darwina_cache',
    LAST_UPDATE: 'last_full_update',
    STORE_DATA: (store) => `darwina_store_${store || 'ALL'}`,
    SELECTED_STORE: 'selectedStore',
    SELECTED_USER: 'selectedUserId',
    DEBUG_MODE: 'debugMode',
    LEAD_COUNTS: 'leadCounts',
    LANGUAGE: 'language'
};

// Storage quota thresholds
export const QUOTA_WARNING_THRESHOLD = 0.8;  // 80% of quota
export const QUOTA_CRITICAL_THRESHOLD = 0.9; // 90% of quota
export const CLEANUP_BATCH_SIZE = 50;        // Number of items to clean up at once

// Lock timeout
export const LOCK_TIMEOUT = 5000; // 5 seconds 