/**
 * Enum for log levels
 * @readonly
 * @enum {string}
 */
export const LogLevel = {
    /** Critical errors that require immediate attention */
    ERROR: 'ERROR',
    
    /** Warning messages for potential issues */
    WARN: 'WARN',
    
    /** Informational messages about normal operation */
    INFO: 'INFO',
    
    /** Detailed messages for debugging */
    DEBUG: 'DEBUG',
    
    /** Success messages for completed operations */
    SUCCESS: 'SUCCESS',
    
    /** Trace messages for detailed debugging */
    TRACE: 'TRACE'
}; 