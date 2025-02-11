/**
 * Event types and logging levels for the application
 */

// Event Types
export const EventType = {
    // Interface events
    STORE_CHANGED: 'store:changed',
    TAB_CHANGED: 'tab:changed',
    LANGUAGE_CHANGED: 'language:changed',
    THEME_CHANGED: 'theme:changed',
    INTERFACE_UPDATED: 'interface:updated',
    RUN_TESTS: 'action:run_tests',
    CHECK_STATUS: 'action:check_status',
    ORDERS_CHECKED: 'action:orders_checked',
    LEAD_STATUS_CLICKED: 'action:lead_status_clicked',
    
    // System events
    SYSTEM_ERROR: 'system:error',
    SYSTEM_READY: 'system:ready',
    SYSTEM_BUSY: 'system:busy'
};

// Error Types
export const ErrorType = {
    INITIALIZATION: 'initialization_error',
    UI: 'ui_error',
    API: 'api_error',
    DATA: 'data_error',
    VALIDATION: 'validation_error',
    CLEANUP: 'cleanup_error'
};

// Error Severity Levels
export const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// Log Levels
export const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    SUCCESS: 'success'
};

export default {
    EventType,
    ErrorType,
    ErrorSeverity,
    LogLevel
}; 