import { getDarwinaCredentials, API_CONFIG } from './config/api.js';
import { stores } from './services/stores.js';
import { OrderService } from './services/api/OrderService.js';
import { STORAGE_KEYS } from './config/storage.js';
import { 
    DEFAULT_INTERVALS,
    INTERVAL_KEYS,
    getIntervalSettings,
    saveIntervalSettings 
} from './config/intervals.js';
import testRunner from './services/testRunner.js';
import { BaseManager } from './services/core/BaseManager.js';
import { userCardService } from './services/userCard.js';
import { ALARM_NAMES, LogLevel, ErrorType, ErrorSeverity } from './services/constants.js';

// Import all managers from central managers file
import {
    managers,
    getLogManager,
    getEventManager,
    getStorageManager,
    getCacheManager,
    getAlarmManager,
    getMessageManager,
    getStoreManager,
    getOperationProgressManager,
    getNotificationManager,
    getCounterManager,
    getDataManager
} from './services/core/managers.js';

// Constants
const FETCH_INTERVAL = 5; // minutes
const CHECK_INTERVAL = 15; // minutes

// Cache configuration
const CACHE_KEY = 'darwina_data_cache';
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Stałe dla świeżości danych
const DATA_FRESHNESS_TIMEOUT = 5 * 60 * 1000; // 5 minut
const STORE_CHANGE_TIMEOUT = 30 * 60 * 1000;  // 30 minut

// Konfiguracja limitów powiadomień
const NOTIFICATION_LIMITS = {
    PER_MINUTE: 10,
    PER_HOUR: 30,
    PER_DAY: 100,
    COOLDOWN_MS: 3000 // 3 sekundy między powiadomieniami
};

// Initialize manager instances
const logManager = getLogManager();
const eventManager = getEventManager();
const storageManager = getStorageManager();
const cacheManager = getCacheManager();
const alarmManager = getAlarmManager();
const messageManager = getMessageManager();
const storeManager = getStoreManager();
const operationProgressManager = getOperationProgressManager();
const notificationManager = getNotificationManager();
const counterManager = getCounterManager();
const dataManager = getDataManager();

const INITIALIZATION_TIMEOUT = 30000; // 30 seconds
const ALARM_QUEUE_TIMEOUT = 5000; // 5 seconds
const RETRY_DELAY = 1000; // 1 second

// Queue for alarms received before system is ready
const alarmQueue = new Map();

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // ... existing code ...
}

/**
 * Setup progress tracking
 */
function setupProgressTracking() {
    // ... existing code ...
}

// Export managers for use in other modules
export { managers };

/**
 * Initialize the system
 */
async function initializeSystem() {
    try {
        // Get core managers first
        const errorHandler = await managers.get('error');
        const logManager = await managers.get('log');
        
        // Log initialization start
        logManager.log(LogLevel.INFO, '🚀 Starting system initialization...');

        // Initialize with timeout
        const initPromise = managers.initializeAll();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`System initialization timed out after ${INITIALIZATION_TIMEOUT}ms`));
            }, INITIALIZATION_TIMEOUT);
        });

        await Promise.race([initPromise, timeoutPromise]);
        
        logManager.log(LogLevel.SUCCESS, '✅ System initialized successfully');
        
        // Process any queued alarms
        await processAlarmQueue();
        
        return true;
    } catch (error) {
        console.error('❌ System initialization failed:', error);
        
        // Try to log through LogManager if available
        try {
            const logManager = await managers.get('log');
            logManager.log(LogLevel.ERROR, '❌ System initialization failed', error);
        } catch {
            // Fallback to console if LogManager not available
            console.error('Failed to log through LogManager:', error);
        }
        
        return false;
    }
}

/**
 * Queue alarm for later processing
 */
function queueAlarm(alarm) {
    if (!alarm) return;
    
    alarmQueue.set(alarm.name, {
        alarm,
        timestamp: Date.now()
    });
    
    console.log(`📥 Queued alarm: ${alarm.name}`);
}

/**
 * Process queued alarms
 */
async function processAlarmQueue() {
    if (alarmQueue.size === 0) return;
    
    const logManager = await managers.get('log');
    logManager.log(LogLevel.INFO, `🔄 Processing ${alarmQueue.size} queued alarms...`);
    
    const now = Date.now();
    
    for (const [name, entry] of alarmQueue) {
        try {
            // Skip expired alarms
            if (now - entry.timestamp > ALARM_QUEUE_TIMEOUT) {
                logManager.log(LogLevel.WARN, `⚠️ Alarm ${name} expired, skipping`);
                continue;
            }
            
            await handleAlarm(entry.alarm);
        } catch (error) {
            logManager.log(LogLevel.ERROR, `❌ Failed to process queued alarm: ${name}`, error);
        } finally {
            alarmQueue.delete(name);
        }
    }
    
    logManager.log(LogLevel.SUCCESS, '✅ Alarm queue processed');
}

/**
 * Handle alarm
 */
async function handleAlarm(alarm) {
    if (!alarm?.name) return;
    
    const logManager = await managers.get('log');
    
    try {
        logManager.log(LogLevel.INFO, `⏰ Handling alarm: ${alarm.name}`);
        
        switch (alarm.name) {
            case ALARM_NAMES.CHECK_UPDATES:
                await managers.get('update').then(m => m.checkForUpdates());
                break;
                
            case ALARM_NAMES.REFRESH_DATA:
                await managers.get('refresh').then(m => m.refreshData());
                break;
                
            case ALARM_NAMES.SYNC_SETTINGS:
                await managers.get('settings').then(m => m.syncSettings());
                break;
                
            case ALARM_NAMES.CLEANUP:
                await managers.get('cache').then(m => m.cleanup());
                await managers.get('log').then(m => m.cleanup());
                break;
                
            default:
                logManager.log(LogLevel.WARN, `⚠️ Unknown alarm: ${alarm.name}`);
        }
        
        logManager.log(LogLevel.SUCCESS, `✅ Alarm ${alarm.name} handled successfully`);
    } catch (error) {
        logManager.log(LogLevel.ERROR, `❌ Failed to handle alarm: ${alarm.name}`, error);
        throw error;
    }
}

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        const logManager = await managers.get('log');
        
        switch (details.reason) {
            case 'install':
                logManager.log(LogLevel.INFO, '🎉 Extension installed');
                await initializeSystem();
                break;
                
            case 'update':
                logManager.log(LogLevel.INFO, '🔄 Extension updated', {
                    from: details.previousVersion,
                    to: chrome.runtime.getManifest().version
                });
                await initializeSystem();
                break;
                
            case 'chrome_update':
            case 'shared_module_update':
                logManager.log(LogLevel.INFO, '🔄 Chrome updated');
                await initializeSystem();
                break;
        }
    } catch (error) {
        console.error('Failed to handle installation:', error);
    }
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    try {
        // Queue alarm if system not ready
        if (!await managers.isInitialized()) {
            queueAlarm(alarm);
            return;
        }
        
        await handleAlarm(alarm);
    } catch (error) {
        console.error('Failed to handle alarm:', error);
    }
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Keep the channel open for async response
    const handleMessage = async () => {
        try {
            // Initialize system if not ready
            if (!await managers.isInitialized()) {
                await initializeSystem();
            }
            
            const { type, data } = request;
            const logManager = await managers.get('log');
            
            logManager.log(LogLevel.DEBUG, `📨 Received message: ${type}`, data);
            
            let response;
            switch (type) {
                case 'getState':
                    response = await managers.get('state').then(m => m.getState());
                    break;
                    
                case 'updateSettings':
                    response = await managers.get('settings').then(m => m.updateSettings(data));
                    break;
                    
                case 'refreshData':
                    response = await managers.get('refresh').then(m => m.refreshData());
                    break;
                    
                default:
                    throw new Error(`Unknown message type: ${type}`);
            }
            
            sendResponse({ success: true, data: response });
        } catch (error) {
            console.error('Failed to handle message:', error);
            sendResponse({ success: false, error: error.message });
        }
    };
    
    handleMessage().catch(error => {
        console.error('Message handler failed:', error);
        sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep channel open for async response
});
  