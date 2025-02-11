/**
 * Cache configuration
 * @module config/cache
 */

/**
 * Cache memory limits
 */
export const CacheLimits = {
    memory: 20 * 1024 * 1024,    // 20MB total
    perEndpoint: 5 * 1024 * 1024, // 5MB per endpoint
    minFree: 1 * 1024 * 1024     // 1MB minimum free
};

/**
 * Cache TTL configuration per endpoint
 */
export const EndpointTTL = {
    '/orders': 5 * 60 * 1000,        // 5 minut
    '/auth/access_token': 55 * 60 * 1000, // 55 minut
    default: 15 * 60 * 1000          // 15 minut
};

/**
 * Cache priority levels
 */
export const CachePriorities = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

/**
 * Cache compression settings
 */
export const CompressionConfig = {
    enabled: true,
    threshold: 1024, // Compress data larger than 1KB
    level: 6        // Compression level (1-9, where 9 is max compression)
};

/**
 * Cache cleanup settings
 */
export const CleanupConfig = {
    interval: 5 * 60 * 1000,  // Cleanup every 5 minutes
    maxAge: 24 * 60 * 60 * 1000, // Remove entries older than 24 hours
    lowWatermark: 0.8,        // Start cleanup when cache is 80% full
    highWatermark: 0.9        // Aggressive cleanup when cache is 90% full
}; 