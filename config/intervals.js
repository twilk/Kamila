// Default intervals in milliseconds
export const INTERVALS = {
    REFRESH: 300000,         // 5 minutes
    BACKGROUND_CHECK: 60000, // 1 minute
    FULL_REFRESH: 300000,    // 5 minutes
    DATA_FRESHNESS: 300000   // 5 minutes
};

// Default intervals in minutes (for UI)
export const DEFAULT_INTERVALS = {
    BACKGROUND_CHECK: 1,  // 1 minute
    FULL_REFRESH: 5,     // 5 minutes
    DATA_FRESHNESS: 5    // 5 minutes
};

// Storage keys for intervals
export const INTERVAL_KEYS = {
    BACKGROUND_CHECK: 'background_check_interval',
    FULL_REFRESH: 'full_refresh_interval',
    DATA_FRESHNESS: 'data_freshness_interval'
};

// Refresh configuration
export const REFRESH_CONFIG = {
    STORAGE_KEY: 'refresh_settings',
    DEFAULT_SETTINGS: {
        check_frequency: '1m',
        notification_interval: '5m',
        full_refresh: '5m',
        delta_update: '1m'
    },
    INTERVALS: {
        CHECK: 60000,        // 1 minute
        NOTIFICATION: 300000, // 5 minutes
        FULL_REFRESH: 300000, // 5 minutes
        DELTA_UPDATE: 60000   // 1 minute
    }
};

// Validate and save interval settings
export async function saveIntervalSettings(intervals, storageManager) {
    const validatedIntervals = {
        [INTERVAL_KEYS.BACKGROUND_CHECK]: Math.max(1, Math.min(60, intervals.backgroundCheck || DEFAULT_INTERVALS.BACKGROUND_CHECK)),
        [INTERVAL_KEYS.FULL_REFRESH]: Math.max(5, Math.min(60, intervals.fullRefresh || DEFAULT_INTERVALS.FULL_REFRESH)),
        [INTERVAL_KEYS.DATA_FRESHNESS]: Math.max(1, Math.min(60, intervals.dataFreshness || DEFAULT_INTERVALS.DATA_FRESHNESS))
    };

    await storageManager.save('intervals', validatedIntervals);
    return validatedIntervals;
}

// Get current interval settings
export async function getIntervalSettings(storageManager) {
    const intervals = await storageManager.load('intervals');
    return {
        backgroundCheck: intervals?.[INTERVAL_KEYS.BACKGROUND_CHECK] || DEFAULT_INTERVALS.BACKGROUND_CHECK,
        fullRefresh: intervals?.[INTERVAL_KEYS.FULL_REFRESH] || DEFAULT_INTERVALS.FULL_REFRESH,
        dataFreshness: intervals?.[INTERVAL_KEYS.DATA_FRESHNESS] || DEFAULT_INTERVALS.DATA_FRESHNESS
    };
} 