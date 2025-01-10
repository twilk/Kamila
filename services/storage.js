/**
 * Stałe dla kluczy storage
 */
export const STORAGE_KEYS = {
    CACHE: 'darwina_cache',
    LAST_UPDATE: 'last_full_update',
    STORE_DATA: (store) => `darwina_store_${store || 'ALL'}`,
    SELECTED_STORE: 'selectedStore',
    SELECTED_USER: 'selectedUserId',
    DEBUG_MODE: 'debugMode'
};

/**
 * Helper function do zapisywania danych w chrome.storage.local
 * @param {string} key - Klucz pod którym zapisać dane
 * @param {any} data - Dane do zapisania
 * @returns {Promise<void>}
 */
export async function saveToStorage(key, data) {
    try {
        await chrome.storage.local.set({ [key]: data });
    } catch (error) {
        console.error(`Error saving to storage (${key}):`, error);
        throw error;
    }
}

/**
 * Helper function do odczytywania danych z chrome.storage.local
 * @param {string} key - Klucz do odczytania
 * @returns {Promise<any>} - Odczytane dane lub null
 */
export async function getFromStorage(key) {
    try {
        const result = await chrome.storage.local.get(key);
        return result[key] || null;
    } catch (error) {
        console.error(`Error reading from storage (${key}):`, error);
        throw error;
    }
}

/**
 * Helper function do usuwania danych z chrome.storage.local
 * @param {string} key - Klucz do usunięcia
 * @returns {Promise<void>}
 */
export async function removeFromStorage(key) {
    try {
        await chrome.storage.local.remove(key);
    } catch (error) {
        console.error(`Error removing from storage (${key}):`, error);
        throw error;
    }
}

/**
 * Helper function do sprawdzania rozmiaru danych w storage
 * @returns {Promise<{bytesInUse: number, quotaBytes: number}>}
 */
export async function getStorageInfo() {
    try {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const { quotaBytes } = await chrome.storage.local.get();
        return { bytesInUse, quotaBytes };
    } catch (error) {
        console.error('Error getting storage info:', error);
        throw error;
    }
}

/**
 * Helper function do czyszczenia całego storage
 * @returns {Promise<void>}
 */
export async function clearStorage() {
    try {
        await chrome.storage.local.clear();
    } catch (error) {
        console.error('Error clearing storage:', error);
        throw error;
    }
}

// Default values for request intervals
export const DEFAULT_INTERVALS = {
    BACKGROUND_CHECK: 1,  // 1 minute
    FULL_REFRESH: 5,     // 5 minutes
    DATA_FRESHNESS: 5    // 5 minutes
};

// Storage keys for request intervals
export const INTERVAL_KEYS = {
    BACKGROUND_CHECK: 'background_check_interval',
    FULL_REFRESH: 'full_refresh_interval',
    DATA_FRESHNESS: 'data_freshness_interval'
};

// Validate and save interval settings
export async function saveIntervalSettings(intervals) {
    // Validate intervals
    const validatedIntervals = {
        [INTERVAL_KEYS.BACKGROUND_CHECK]: Math.max(1, Math.min(60, intervals.backgroundCheck || DEFAULT_INTERVALS.BACKGROUND_CHECK)),
        [INTERVAL_KEYS.FULL_REFRESH]: Math.max(5, Math.min(60, intervals.fullRefresh || DEFAULT_INTERVALS.FULL_REFRESH)),
        [INTERVAL_KEYS.DATA_FRESHNESS]: Math.max(1, Math.min(60, intervals.dataFreshness || DEFAULT_INTERVALS.DATA_FRESHNESS))
    };

    // Save to storage
    await chrome.storage.local.set({ intervals: validatedIntervals });
    return validatedIntervals;
}

// Get current interval settings
export async function getIntervalSettings() {
    const { intervals } = await chrome.storage.local.get('intervals');
    return {
        backgroundCheck: intervals?.[INTERVAL_KEYS.BACKGROUND_CHECK] || DEFAULT_INTERVALS.BACKGROUND_CHECK,
        fullRefresh: intervals?.[INTERVAL_KEYS.FULL_REFRESH] || DEFAULT_INTERVALS.FULL_REFRESH,
        dataFreshness: intervals?.[INTERVAL_KEYS.DATA_FRESHNESS] || DEFAULT_INTERVALS.DATA_FRESHNESS
    };
} 