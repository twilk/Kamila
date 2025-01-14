/**
 * Cache priority levels
 * @enum {number}
 */
export const CachePriority = {
    /** Critical data, keep as long as possible */
    HIGH: 1,
    /** Important data, normal TTL */
    MEDIUM: 2,
    /** Temporary data, short TTL */
    LOW: 3
};

/**
 * Cache entry options
 * @typedef {Object} CacheOptions
 * @property {number} [ttl=300000] Time to live in milliseconds
 * @property {CachePriority} [priority=CachePriority.MEDIUM] Cache priority
 * @property {boolean} [compression=false] Whether to compress the data
 * @property {boolean} [persistent=false] Whether to persist in storage
 */

/**
 * Cache entry
 * @typedef {Object} CacheEntry
 * @property {*} value The cached value
 * @property {number} expires Expiration timestamp
 * @property {CachePriority} priority Cache priority
 * @property {boolean} compressed Whether the data is compressed
 * @property {number} updated Last update timestamp
 */ 