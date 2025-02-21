/**
 * Log levels
 * @enum {string}
 */
export const LogLevel = {
    ERROR: 'ERROR',
    WARN: 'WARN', 
    INFO: 'INFO',
    DEBUG: 'DEBUG',
    SUCCESS: 'SUCCESS'
};

/**
 * Error types
 * @enum {string}
 */
export const ErrorType = {
    INITIALIZATION: 'INITIALIZATION',
    RUNTIME: 'RUNTIME',
    NETWORK: 'NETWORK',
    STORAGE: 'STORAGE',
    UI: 'UI',
    EVENT: 'EVENT',
    API: 'API',
    CACHE: 'CACHE',
    DATA_REFRESH: 'DATA_REFRESH',
    BROADCAST: 'BROADCAST',
    EVENT_LISTENER: 'EVENT_LISTENER',
    EVENT_EMISSION: 'EVENT_EMISSION',
    EVENT_QUEUE_PROCESSING: 'EVENT_QUEUE_PROCESSING',
    MAX_LISTENERS_EXCEEDED: 'MAX_LISTENERS_EXCEEDED',
    LOG_PROCESSING: 'LOG_PROCESSING',
    LOGGING: 'LOGGING',
    CLEANUP: 'CLEANUP',
    STORE_CHANGE: 'STORE_CHANGE',
    UPDATE: 'UPDATE',
    NAVIGATION: 'NAVIGATION',
    ACTION: 'ACTION',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Error severity levels
 * @enum {string}
 */
export const ErrorSeverity = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

/**
 * Alarm names
 * @enum {string}
 */
export const ALARM_NAMES = {
    CHECK_UPDATES: 'CHECK_UPDATES',
    REFRESH_DATA: 'REFRESH_DATA',
    SYNC_SETTINGS: 'SYNC_SETTINGS',
    CLEANUP: 'CLEANUP',
    CHECK_ORDERS: 'CHECK_ORDERS',
    UPDATE_COUNTERS: 'UPDATE_COUNTERS'
};

/**
 * Event types
 * @enum {string}
 */
export const EventType = {
    // System events
    INITIALIZED: 'system:initialized',
    ERROR: 'system:error',
    WARNING: 'system:warning',
    
    // UI events
    VIEW_CHANGED: 'ui:view-changed',
    THEME_CHANGED: 'ui:theme-changed',
    LANGUAGE_CHANGED: 'ui:language-changed',
    WINDOW_RESIZED: 'ui:window-resized',
    
    // Data events
    DATA_UPDATED: 'data:updated',
    DATA_REFRESH_NEEDED: 'data:refresh-needed',
    DATA_REFRESH_STARTED: 'data:refresh-started',
    DATA_REFRESH_COMPLETED: 'data:refresh-completed',
    DATA_REFRESH_FAILED: 'data:refresh-failed',
    
    // Store events
    STORE_CHANGED: 'store:changed',
    STORE_UPDATED: 'store:updated',
    STORE_SELECTED: 'store:selected',
    
    // Order events
    ORDERS_UPDATED: 'orders:updated',
    ORDER_STATUS_CHANGED: 'order:status-changed',
    ORDER_COUNTS_UPDATED: 'order:counts-updated',
    ORDER_REFRESH_NEEDED: 'order:refresh-needed',
    ORDER_REFRESH_STARTED: 'order:refresh-started',
    ORDER_REFRESH_COMPLETED: 'order:refresh-completed',
    
    // Cache events
    CACHE_UPDATED: 'cache:updated',
    CACHE_CLEARED: 'cache:cleared',
    CACHE_ITEM_EXPIRED: 'cache:item-expired',
    
    // Storage events
    STORAGE_UPDATED: 'storage:updated',
    STORAGE_CLEARED: 'storage:cleared',
    STORAGE_QUOTA_EXCEEDED: 'storage:quota-exceeded',
    
    // Network events
    NETWORK_ERROR: 'network:error',
    NETWORK_OFFLINE: 'network:offline',
    NETWORK_ONLINE: 'network:online',
    
    // Update events
    UPDATE_AVAILABLE: 'update:available',
    UPDATE_STARTED: 'update:started',
    UPDATE_COMPLETED: 'update:completed',
    UPDATE_FAILED: 'update:failed',
    
    // Counter events
    COUNTERS_UPDATED: 'counters:updated',
    COUNTER_REFRESH_NEEDED: 'counters:refresh-needed',
    
    // Message events
    MESSAGE_RECEIVED: 'message:received',
    MESSAGE_SENT: 'message:sent',
    MESSAGE_ERROR: 'message:error',
    
    // Test events
    TEST_STARTED: 'test:started',
    TEST_COMPLETED: 'test:completed',
    TEST_FAILED: 'test:failed',
    
    // User events
    USER_ACTION: 'user:action',
    USER_SETTING_CHANGED: 'user:setting-changed'
};

/**
 * API configuration
 * @const
 */
export const API_CONFIG = {
    BASE_URL: 'https://darwina.pl/api',
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    BATCH_SIZE: 100,
    MAX_CONCURRENT_REQUESTS: 5,
    ENDPOINTS: {
        AUTH: '/auth',
        ORDERS: '/orders',
        STORES: '/stores',
        SETTINGS: '/settings',
        VERSION: '/version',
        COUNTERS: '/counters',
        USERS: '/users',
        LOGS: '/logs'
    },
    HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

/**
 * Cache configuration
 * @const
 */
export const CACHE_CONFIG = {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    COMPRESSION_THRESHOLD: 1024 * 1024 // 1MB
};

/**
 * UI configuration
 * @const
 */
export const UI_CONFIG = {
    ANIMATION_DURATION: 300,
    TOAST_DURATION: 3000,
    MODAL_ANIMATION_DURATION: 200,
    MIN_WINDOW_HEIGHT: 400,
    MAX_WINDOW_HEIGHT: 800,
    RESIZE_DEBOUNCE: 100
};

/**
 * Order status types
 * @enum {string}
 */
export const OrderStatus = {
    NEW: '1',
    CONFIRMED: '2',
    ACCEPTED: '3',
    IN_PROGRESS: '4',
    READY: '5',
    COMPLETED: '6',
    CANCELLED: '7'
};

/**
 * Store types
 * @enum {string}
 */
export const StoreType = {
    ALL: 'ALL',
    RETAIL: 'RETAIL',
    WHOLESALE: 'WHOLESALE',
    ONLINE: 'ONLINE'
};

/**
 * Theme types
 * @enum {string}
 */
export const ThemeType = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
};

/**
 * Language types
 * @enum {string}
 */
export const LanguageType = {
    PL: 'polish',
    EN: 'english'
};

/**
 * Message types
 * @enum {string}
 */
export const MessageType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

/**
 * Toast positions
 * @enum {string}
 */
export const ToastPosition = {
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right'
};

/**
 * Test types
 * @enum {string}
 */
export const TestType = {
    UNIT: 'unit',
    INTEGRATION: 'integration',
    E2E: 'e2e'
};

/**
 * Operation status
 * @enum {string}
 */
export const OperationStatus = {
    PENDING: 'pending',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
}; 