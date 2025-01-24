/**
 * Default timeout for manager initialization (2 seconds)
 * @type {number}
 */
export const DEFAULT_INIT_TIMEOUT = 2000;

/**
 * Maximum number of retry attempts
 * @type {number}
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Delay between retry attempts (exponential backoff)
 * @type {number}
 */
export const RETRY_DELAY = 1000;

/**
 * Custom timeouts for specific managers (in milliseconds)
 * @type {Object.<string, number>}
 */
export const MANAGER_TIMEOUTS = {
    // Core managers (longer timeouts)
    'connectionmanager': 5000,  // Network operations need more time
    'cachemanager': 3000,      // Storage operations may be slow
    'datamanager': 4000,       // Data loading can take time
    
    // UI managers (shorter timeouts)
    'uimanager': 1500,
    'menumanager': 1000,
    'debugmanager': 1000,
    
    // Feature managers (medium timeouts)
    'languagemanager': 2000,
    'updatemanager': 2500,
    'statusmanager': 2000,
    
    // System managers (short timeouts)
    'errorhandler': 1000,
    'eventmanager': 1000,
    'loadingmanager': 1000,
    'volumemanager': 1000,
    'refreshmanager': 1000
};

/**
 * Get timeout for a specific manager
 * @param {string} managerName Name of the manager
 * @returns {number} Timeout in milliseconds
 */
export function getManagerTimeout(managerName) {
    return MANAGER_TIMEOUTS[managerName.toLowerCase()] || DEFAULT_INIT_TIMEOUT;
}

/**
 * Calculate retry delay with exponential backoff
 * @param {number} attempt Current attempt number
 * @returns {number} Delay in milliseconds
 */
export function getRetryDelay(attempt) {
    return Math.min(RETRY_DELAY * Math.pow(2, attempt - 1), 10000);
} 