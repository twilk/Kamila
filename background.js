import { getDarwinaCredentials } from './config/api.js';
import { API_CONFIG } from './config/api.js';
import { stores } from './services/stores.js';
import { UserCardService } from './services/userCard.js';
import { OrderService } from './services/api/OrderService.js';
import { STORAGE_KEYS } from './config/storage.js';
import { storageManager } from './services/core/StorageManager.js';
import { 
    DEFAULT_INTERVALS,
    INTERVAL_KEYS,
    getIntervalSettings,
    saveIntervalSettings 
} from './config/intervals.js';
import testRunner from './services/testRunner.js';
import { i18n } from './services/i18n.js';
import { storeManager } from './services/core/StoreManager.js';
import { ThemeManager } from './services/core/ThemeManager.js';
import { CacheManager } from './services/core/CacheManager.js';
import { UIManager } from './services/core/UIManager.js';
import { DataManager } from './services/core/DataManager.js';
import { InitializationManager } from './services/core/InitializationManager.js';
import { ErrorHandler } from './services/core/ErrorHandler.js';
import { LogLevel } from './services/core/LogLevel.js';
import { alarmManager } from './services/core/managers.js';
import { messageManager } from './services/core/MessageManager.js';
import { userCardService } from './services/userCard.js';
import { operationProgressManager } from './services/core/OperationProgressManager.js';
import { counterManager } from './services/core/managers.js';

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

// System zarządzania powiadomieniami
class NotificationManager {
    static #instance = null;
    
    constructor() {
        if (NotificationManager.#instance) {
            throw new Error('Use NotificationManager.getInstance()');
        }
        this.notificationHistory = [];
        this.lastNotificationTime = 0;
        
        // Bezpieczna inicjalizacja alarmów
        this.initializeAlarms();
    }

    async initializeAlarms() {
        // Poczekaj na załadowanie chrome.alarms
        await new Promise((resolve) => {
            if (chrome?.alarms) {
                resolve();
            } else {
                setTimeout(() => {
                    if (chrome?.alarms) {
                        resolve();
                    } else {
                        console.warn('Chrome Alarms API not available after timeout');
                        resolve(); // Rozwiąż promise mimo błędu
                    }
                }, 1000);
            }
        });

        // Sprawdź czy API jest dostępne
        if (!chrome?.alarms) {
            console.warn('Chrome Alarms API is not available, using fallback');
            this.initializeFallbackNotifications();
            return;
        }

        try {
            // Najpierw usuń poprzedni listener jeśli istnieje
            if (chrome.alarms.onAlarm.hasListeners()) {
                chrome.alarms.onAlarm.removeListener(this.handleAlarm.bind(this));
            }

            // Dodaj nowy listener
            chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));

            // Utwórz alarm
            await chrome.alarms.create('checkNotifications', {
                periodInMinutes: 5 // Co 5 minut
            });

            console.log('[DEBUG] ✅ Alarms initialized successfully');
        } catch (error) {
            console.error('Failed to initialize alarms:', error);
            this.initializeFallbackNotifications();
        }
    }

    handleAlarm = async (alarm) => {
        if (alarm.name === 'checkNotifications') {
            await this.checkAndNotify();
        }
    }

    initializeFallbackNotifications() {
        console.log('[DEBUG] 🔄 Using fallback notification system');
        // Fallback using setInterval
        setInterval(async () => {
            await this.checkAndNotify();
        }, 5 * 60 * 1000); // Co 5 minut
    }

    static getInstance() {
        if (!NotificationManager.#instance) {
            NotificationManager.#instance = new NotificationManager();
        }
        return NotificationManager.#instance;
    }

    async canShowNotification() {
        const now = Date.now();
        
        // Usuń stare wpisy (starsze niż 24h)
        this.notificationHistory = this.notificationHistory.filter(
            time => now - time < 24 * 60 * 60 * 1000
        );

        // Sprawdź cooldown
        if (now - this.lastNotificationTime < NOTIFICATION_LIMITS.COOLDOWN_MS) {
            console.log('[DEBUG] 🕒 Cooldown aktywny, pomijam powiadomienie');
            return false;
        }

        // Pobierz ustawienia użytkownika
        const { notificationSettings } = await chrome.storage.local.get('notificationSettings');
        const userLimits = notificationSettings?.limits || NOTIFICATION_LIMITS;

        // Sprawdź limity
        const lastMinute = this.notificationHistory.filter(
            time => now - time < 60 * 1000
        ).length;
        if (lastMinute >= userLimits.PER_MINUTE) {
            console.log('[DEBUG] ⚠️ Przekroczono limit powiadomień na minutę');
            return false;
        }

        const lastHour = this.notificationHistory.filter(
            time => now - time < 60 * 60 * 1000
        ).length;
        if (lastHour >= userLimits.PER_HOUR) {
            console.log('[DEBUG] ⚠️ Przekroczono limit powiadomień na godzinę');
            return false;
        }

        const lastDay = this.notificationHistory.length;
        if (lastDay >= userLimits.PER_DAY) {
            console.log('[DEBUG] ⚠️ Przekroczono dzienny limit powiadomień');
            return false;
        }

        return true;
    }

    async trackNotification() {
        const now = Date.now();
        this.notificationHistory.push(now);
        this.lastNotificationTime = now;
        
        // Zapisz historię do storage dla persystencji
        await storageManager.save('notifications', {
            history: this.notificationHistory,
            lastTime: this.lastNotificationTime
        });
    }

    async initialize() {
        // Wczytaj historię z storage
        const data = await storageManager.load('notifications');
        
        if (data) {
            this.notificationHistory = data.history || [];
            this.lastNotificationTime = data.lastTime || 0;
        }
    }

    getStats() {
        const now = Date.now();
        return {
            lastMinute: this.notificationHistory.filter(time => now - time < 60 * 1000).length,
            lastHour: this.notificationHistory.filter(time => now - time < 60 * 60 * 1000).length,
            lastDay: this.notificationHistory.length,
            timeSinceLastNotification: now - this.lastNotificationTime
        };
    }

    async checkAndNotify() {
        try {
            console.log('[DEBUG] 🔍 Sprawdzam nowe powiadomienia...');
            
            // Pobierz dane o zamówieniach
            const orderService = await getOrderService();
            if (!orderService) {
                console.warn('[WARN] ⚠️ OrderService nie jest dostępny');
                return;
            }

            // Pobierz ostatnio sprawdzony timestamp
            const { lastCheck } = await chrome.storage.local.get('lastNotificationCheck');
            const now = Date.now();
            
            // Pobierz nowe zamówienia
            const newOrders = await orderService.fetchNewOrders(lastCheck);
            
            // Aktualizuj timestamp ostatniego sprawdzenia
            await chrome.storage.local.set({ lastNotificationCheck: now });

            if (!newOrders?.length) {
                console.log('[DEBUG] ℹ️ Brak nowych zamówień do powiadomień');
                return;
            }

            console.log(`[DEBUG] 📬 Znaleziono ${newOrders.length} nowych zamówień`);

            // Pokaż powiadomienia dla każdego nowego zamówienia
            for (const order of newOrders) {
                await createOrderNotification(order, order.status_name);
            }

            console.log('[DEBUG] ✅ Zakończono sprawdzanie powiadomień');
        } catch (error) {
            console.error('[ERROR] ❌ Błąd podczas sprawdzania powiadomień:', error);
            ErrorHandler.handleError(error, 'NOTIFICATION_CHECK', {
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Inicjalizacja managera powiadomień
const notificationManager = NotificationManager.getInstance();
notificationManager.initialize().catch(console.error);

// Funkcja do tworzenia powiadomienia o nowym zamówieniu
async function createOrderNotification(order, status) {
    try {
        // Upewnij się, że tłumaczenia są załadowane
        await i18n.waitForTranslations();
        
        // Sprawdź limity przed pokazaniem powiadomienia
        const canShow = await notificationManager.canShowNotification();
        if (!canShow) {
            console.log('[DEBUG] 🚫 Pominięto powiadomienie ze względu na limity');
            return;
        }

        const orderUrl = `${API_CONFIG.DARWINA.BASE_URL}/orders/${order.order_id}`;
        const notificationId = `order-${order.order_id}`;
        
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icon128.png',
            title: i18n.translate('newOrderNotification'),
            message: i18n.translate('orderNotificationFormat', {
                id: order.order_id,
                status: status,
                store: order.delivery_name || 'Nieznany sklep',
                value: order.total_price ? `${order.total_price} zł` : 'N/A'
            }),
            buttons: [
                {
                    title: i18n.translate('viewOrder')
                }
            ],
            requireInteraction: true,
            silent: false
        });

        // Śledź wyświetlone powiadomienie
        await notificationManager.trackNotification();
        
        console.log('[DEBUG] ✅ Utworzono powiadomienie:', {
            orderId: order.order_id,
            stats: notificationManager.getStats()
        });
    } catch (error) {
        console.error('[ERROR] ❌ Błąd podczas tworzenia powiadomienia:', error);
    }
}

// Funkcja do aktualizacji alarmów
async function updateAlarms(intervals) {
    // Usuń istniejące alarmy
    await chrome.alarms.clear('fetchData');
    await chrome.alarms.clear('checkOrders');
    await chrome.alarms.clear('checkNewOrders');
    
    // Utwórz nowe alarmy z nowymi interwałami
    chrome.alarms.create('fetchData', {
        periodInMinutes: intervals.fullRefresh
    });
    
    chrome.alarms.create('checkOrders', {
        periodInMinutes: intervals.dataFreshness
    });
    
    chrome.alarms.create('checkNewOrders', {
        periodInMinutes: intervals.backgroundCheck
    });
    
    console.log('[DEBUG] ⚙️ Zaktualizowano interwały alarmów:', intervals);
}

// Core services
const services = {
    order: null,
    user: null,
    notification: notificationManager
};

// Core managers
const managers = {
    notification: notificationManager,
    theme: ThemeManager.getInstance(),
    cache: CacheManager.getInstance(),
    ui: UIManager.getInstance(),
    data: DataManager.getInstance(),
    store: storeManager
};

// Initialization manager
const initManager = InitializationManager.getInstance();

// Register managers
Object.entries(managers).forEach(([name, instance]) => {
    initManager.registerManager(name, instance);
});

/**
 * Initialize or get OrderService instance
 * @returns {Promise<OrderService>}
 */
async function getOrderService() {
    if (!services.order) {
        try {
            const credentials = await getDarwinaCredentials();
            if (!credentials?.token) {
                throw new Error('No API token available');
            }
            services.order = new OrderService(credentials);
            console.log('[INFO] ✅ OrderService initialized successfully');
        } catch (error) {
            console.error('[ERROR] ❌ Failed to initialize OrderService:', error);
            throw error;
        }
    }
    return services.order;
}

async function initializeServices() {
    try {
        // Initialize notification manager first
        await services.notification.initialize();
        console.log('[DEBUG] ✅ NotificationManager initialized');

        // Initialize order service
        await getOrderService();

        // Initialize user service
        const credentials = await getDarwinaCredentials();
        services.user = new UserCardService(credentials);

        console.log('[DEBUG] 🔧 Core services initialized');
        return true;
    } catch (error) {
        console.error('[ERROR] ❌ Failed to initialize services:', error);
        return false;
    }
}

// Stałe konfiguracyjne
const ALARM_NAMES = {
    CHECK_NOTIFICATIONS: 'checkNotifications',
    FETCH_DATA: 'fetchData',
    CHECK_ORDERS: 'checkOrders',
    CHECK_NEW_ORDERS: 'checkNewOrders'
};

const ALARM_INTERVALS = {
    [ALARM_NAMES.CHECK_NOTIFICATIONS]: 5,  // co 5 minut
    [ALARM_NAMES.FETCH_DATA]: 15,          // co 15 minut
    [ALARM_NAMES.CHECK_ORDERS]: 5,         // co 5 minut
    [ALARM_NAMES.CHECK_NEW_ORDERS]: 1      // co minutę
};

// Stałe dla inicjalizacji alarmów
const ALARM_CONFIG = {
    MAX_INIT_ATTEMPTS: 3,
    INIT_DELAY: 1000,
    RETRY_DELAY: 2000,
    DEFAULT_INTERVAL: 5
};

// Initialize service worker
let isInitialized = false;
let initializationPromise = null;

async function initializeServiceWorker() {
    if (isInitialized) return true;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            console.log('[DEBUG] 🚀 Starting service worker initialization...');
            
            // Initialize alarm system first
            await alarmManager.initialize();
            
            // Initialize all required services
            await initializeServices();
            
            // Subscribe to alarm events
            alarmManager.on('alarm:triggered', async (event) => {
                switch (event.name) {
                    case 'checkNotifications':
                        await notificationManager?.checkAndNotify();
                        break;
                    case 'fetchData':
                        await fetchDarwinaData();
                        break;
                    case 'checkOrders':
                        await checkAndUpdateOrders();
                        break;
                    case 'checkNewOrders':
                        await checkNewOrders();
                        break;
                }
            });
            
            isInitialized = true;
            console.log('[DEBUG] ✅ Service worker initialized successfully');
            return true;
        } catch (error) {
            console.error('[ERROR] ❌ Service worker initialization failed:', error);
            isInitialized = false;
            initializationPromise = null;
            throw error;
        }
    })();

    return initializationPromise;
}

// Connection handling
let ports = new Set();

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        console.log('[DEBUG] 🔌 New popup connection established');
        ports.add(port);
        
        port.onMessage.addListener(async (message) => {
            try {
                // Ensure service worker is initialized
                await initializeServiceWorker();

                // Handle PING message
                if (message.type === 'PING') {
                    port.postMessage({ type: 'PONG', status: 'OK' });
                    return;
                }

                // Handle GET_CREDENTIALS message
                if (message.type === 'GET_CREDENTIALS') {
                    const credentials = await getDarwinaCredentials();
                    port.postMessage({ 
                        type: 'CREDENTIALS_RESPONSE',
                        credentials 
                    });
                    return;
                }

                // Handle other messages based on type
                switch (message.type) {
                    case 'STATE_SYNC_REQUEST':
                        port.postMessage({
                            type: 'STATE_SYNC_RESPONSE',
                            syncId: message.syncId,
                            state: await getCurrentState()
                        });
                        break;
                    default:
                        console.warn('[WARN] ⚠️ Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('[ERROR] ❌ Error handling message:', error);
                port.postMessage({
                    type: 'ERROR',
                    error: error.message,
                    originalMessage: message
                });
            }
        });

        port.onDisconnect.addListener(() => {
            console.log('[DEBUG] 🔌 Popup connection closed');
            ports.delete(port);
        });
    }
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[DEBUG] 📦 Extension installed/updated');
    await initializeServiceWorker();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('[DEBUG] 🌅 Browser started');
    await initializeServiceWorker();
});

/**
 * Check and update orders with retry mechanism
 */
async function checkAndUpdateOrders(store) {
    try {
        const data = await fetchDarwinaData(store);
        await updateExtensionBadge(data.counts, store);
        
        messageManager.broadcast({
            type: 'COUNTERS_UPDATED',
            payload: {
                counts: data.counts,
                store,
                timestamp: data.timestamp
            }
        });
    } catch (error) {
        ErrorHandler.handle(error, 'Error checking and updating orders');
        throw error;
    }
}

// Handle direct messages (for service worker state check)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
        sendResponse({ type: 'PONG' });
    }
    return true; // Keep the message channel open for async response
});

/**
 * Get current application state
 * @returns {Promise<Object>} Current state
 */
async function getCurrentState() {
    return {
        timestamp: Date.now(),
        store: await storeManager.getCurrentStore(),
        cache: await CacheManager.getInstance().getState(),
        theme: await ThemeManager.getInstance().getCurrentTheme(),
        intervals: await getIntervalSettings()
    };
}

/**
 * Process orders and update counters
 * @param {Array} orders - Array of orders to process
 * @returns {Object} Processed counts
 */
async function processOrders(orders) {
    try {
        await counterManager.updateCounters(orders);
        const { counts } = await counterManager.getCounters();
        return counts;
    } catch (error) {
        ErrorHandler.handle(error, 'Error processing orders');
        throw error;
    }
}

/**
 * Fetch and process Darwina data
 * @param {string} selectedStore - Selected store ID
 * @returns {Promise<Object>} Processed data
 */
async function fetchDarwinaData(selectedStore = 'ALL') {
    try {
        counterManager.setCurrentStore(selectedStore);
        
        const orderService = await getOrderService();
        const orders = await orderService.getOrders(selectedStore);
        
        const counts = await processOrders(orders);
        
        return {
            counts,
            orders,
            timestamp: Date.now()
        };
    } catch (error) {
        ErrorHandler.handle(error, 'Error fetching Darwina data');
        throw error;
    }
}

// Initialize managers
async function initializeManagers() {
    try {
        console.log('🔄 Initializing background services...');

        // Initialize core services
        await Promise.all([
            messageManager.initialize(),
            storageManager.initialize(),
            storeManager.initialize(),
            operationProgressManager.initialize(),
            userCardService.initialize()
        ]);

        // Setup state sync
        setupStateSync();

        // Setup progress tracking
        setupProgressTracking();

        console.log('✅ Background services initialized');
    } catch (error) {
        console.error('❌ Error initializing background services:', error);
    }
}

/**
 * Setup state synchronization with popup
 */
function setupStateSync() {
    // Listen for store changes
    storeManager.addEventListener('storeChanged', async (event) => {
        const { store } = event.detail;
        await messageManager.sendToPopup('STATE_UPDATE', { store });
    });

    // Listen for user changes
    userCardService.addEventListener('userChanged', async (event) => {
        const { user } = event.detail;
        await messageManager.sendToPopup('STATE_UPDATE', { user });
    });
}

/**
 * Setup progress tracking
 */
function setupProgressTracking() {
    // Listen for progress updates
    operationProgressManager.addEventListener('progressUpdate', async (event) => {
        const { operation, current, total, status } = event.detail;
        await messageManager.sendToPopup('PROGRESS_UPDATE', { 
            operation, 
            current, 
            total, 
            status 
        });
    });

    // Listen for operation errors
    operationProgressManager.addEventListener('operationError', async (event) => {
        const { error } = event.detail;
        await messageManager.sendToPopup('ERROR', error);
    });
}

// Initialize when extension loads
initializeManagers();
  