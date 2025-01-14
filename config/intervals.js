// Default intervals in minutes
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