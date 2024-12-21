/**
 * Cache configuration for KAMILA
 */
export const CACHE_CONFIG = {
    // Timeouts
    DEFAULT_TIMEOUT: 10 * 60 * 1000, // 10 minutes
    EXTENDED_TIMEOUT: 30 * 60 * 1000, // 30 minutes for stable data
    CRITICAL_TIMEOUT: 60 * 1000, // 1 minute for critical data

    // Size limits
    MAX_ENTRIES: 100,
    MAX_SIZE_MB: 50,

    // Keys
    PREFIXES: {
        ORDERS: 'orders_',
        USER: 'user_',
        SETTINGS: 'settings_'
    },

    // Invalidation rules
    INVALIDATION: {
        ON_ERROR: true,
        ON_VERSION_CHANGE: true,
        FORCE_REFRESH_PROBABILITY: 0.1 // 10% chance to force refresh
    },

    // Performance thresholds
    THRESHOLDS: {
        WRITE_TIME: 100, // ms
        READ_TIME: 50,   // ms
        SIZE_WARNING: 40 // MB
    }
}; 