/**
 * Event types used throughout the application
 * @enum {string}
 */
export const eventType = {
    // UI Events
    STORE_CHANGED: 'store:changed',
    TAB_CHANGED: 'tab:changed',
    LANGUAGE_CHANGED: 'language:changed',
    THEME_CHANGED: 'theme:changed',
    INTERFACE_UPDATED: 'interface:updated',
    
    // Action Events
    RUN_TESTS: 'action:run_tests',
    CHECK_STATUS: 'action:check_status',
    ORDERS_CHECKED: 'action:orders_checked',
    LEAD_STATUS_CLICKED: 'action:lead_status_clicked',
    
    // Data Events
    DATA_REFRESH: 'data:refresh',
    DATA_UPDATED: 'data:updated',
    DATA_ERROR: 'data:error',
    
    // Status Events
    STATUS_CHANGED: 'status:changed',
    STATUS_ERROR: 'status:error',
    STATUS_UPDATED: 'status:updated',
    
    // Notification Events
    NOTIFICATION_SHOW: 'notification:show',
    NOTIFICATION_HIDE: 'notification:hide',
    NOTIFICATION_CLICKED: 'notification:clicked',
    
    // System Events
    SYSTEM_ERROR: 'system:error',
    SYSTEM_READY: 'system:ready',
    SYSTEM_BUSY: 'system:busy'
};

// Also export as default for convenience
export default eventType; 