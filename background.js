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
import { storeManager } from './services/storeManager.js';
import { ThemeManager } from './services/core/ThemeManager.js';
import { CacheManager } from './services/core/CacheManager.js';
import { UIManager } from './services/core/UIManager.js';
import { DataManager } from './services/core/DataManager.js';
import { InitializationManager } from './services/core/InitializationManager.js';
import { ErrorHandler } from './services/core/ErrorHandler.js';
import { LogLevel } from './services/core/LogLevel.js';

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

// Główna funkcja inicjalizacji
async function initialize() {
    try {
        console.log('[DEBUG] 🚀 Starting extension initialization...');
        
        // Najpierw zainicjalizuj usługi
        const servicesInitialized = await initializeServices();
        if (!servicesInitialized) {
            throw new Error('Failed to initialize services');
        }
        
        // Następnie zainicjalizuj alarmy
        await notificationManager.initializeAlarms();
        
        console.log('[DEBUG] ✅ Extension initialized successfully');
        return true;
    } catch (error) {
        console.error('[ERROR] ❌ Extension initialization failed:', error);
        return false;
    }
}

// Nasłuchuj zdarzeń cyklu życia
chrome.runtime.onInstalled.addListener(() => {
    console.log('[DEBUG] 📦 Extension installed/updated');
    initialize().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
    console.log('[DEBUG] 🌅 Browser started');
    initialize().catch(console.error);
});

// Handler dla alarmów
async function handleAlarm(alarm) {
    try {
        console.log(`[DEBUG] ⏰ Alarm triggered: ${alarm.name}`);
        
        switch (alarm.name) {
            case ALARM_NAMES.CHECK_NOTIFICATIONS:
                await notificationManager?.checkAndNotify();
                break;
            case ALARM_NAMES.FETCH_DATA:
                await fetchDarwinaData();
                break;
            case ALARM_NAMES.CHECK_ORDERS:
                await checkAndUpdateOrders();
                break;
            case ALARM_NAMES.CHECK_NEW_ORDERS:
                await checkNewOrders();
                break;
            default:
                console.warn(`[WARN] ⚠️ Unknown alarm: ${alarm.name}`);
        }
    } catch (error) {
        console.error(`[ERROR] ❌ Error handling alarm ${alarm.name}:`, error);
        ErrorHandler.handleError(error, 'ALARM_HANDLER', { alarmName: alarm.name });
    }
}

/**
 * Check and update orders with retry mechanism
 */
async function checkAndUpdateOrders(store) {
    try {
        const service = await getOrderService();
        const orders = await service.fetchOrders(store);
        console.log(`[DEBUG] ✅ Orders updated successfully for store ${store?.id || 'ALL'}`);
        return orders;
    } catch (error) {
        console.error('[ERROR] ❌ Failed to check orders:', error);
        ErrorHandler.handleError(error, 'Failed to check orders', { store });
        throw error;
    }
}

// Connection handling
let ports = new Set();

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        ports.add(port);
        
        port.onMessage.addListener(async (message) => {
            try {
                // Handle PING message
                if (message.type === 'PING') {
                    port.postMessage({ type: 'PONG' });
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
                        console.warn('Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('Error handling message:', error);
                port.postMessage({
                    type: 'ERROR',
                    error: error.message,
                    originalMessage: message
                });
            }
        });

        port.onDisconnect.addListener(() => {
            ports.delete(port);
        });
    }
});

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

// Fetch data from Darwina API
async function fetchDarwinaData(selectedStore = 'ALL') {
    try {
        console.log('[DEBUG] 🔄 Rozpoczynam pobieranie danych...');
        
        // Initialize API service
        const api = await initializeApi();
        if (!api.success) {
            throw new Error('Failed to initialize API');
        }

        // Prepare request parameters
        const params = {
            status_id: '1,2,3,5', // All statuses in one request
            limit: 50
        };

        // Add store filter if needed
        if (selectedStore !== 'ALL') {
            const store = stores.find(s => s.id === selectedStore);
            if (store?.deliveryId) {
                params.delivery_id = store.deliveryId;
            }
        }

        // Get last update time
        const { lastUpdate } = await chrome.storage.local.get('lastUpdate');
        if (lastUpdate) {
            params.modified_from = new Date(lastUpdate).toISOString();
        }

        // Fetch all orders with pagination
        let allOrders = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            params.page = page;
            const url = new URL(`${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}`);
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value.toString());
            });

            console.log('[DEBUG] 🔍 Wysyłam zapytanie:', {
                page,
                params,
                url: url.toString()
            });

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${api.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            if (!data.data || !Array.isArray(data.data)) {
                throw new Error('Invalid API response format');
            }

            allOrders = [...allOrders, ...data.data];
            
            // Check if we have more pages
            const totalPages = data.metadata?.page_count || 1;
            hasMore = page < totalPages;
            page++;
        }

        // Process orders
        console.log('[DEBUG] 📊 Rozpoczynam analizę', allOrders.length, 'zamówień');
        const counts = processOrders(allOrders);
        
        // Cache results
        await cacheResults(selectedStore, {
            counts,
            orders: allOrders,
            timestamp: Date.now()
        });

        console.log('[DEBUG] ✅ Zakończono analizę wszystkich', allOrders.length, 'zamówień');
        return {
            success: true,
            counts,
            orders: allOrders
        };
    } catch (error) {
        console.error('[ERROR] ❌ Błąd pobierania danych:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Process orders and count statuses
function processOrders(orders) {
    // Safety check for input
    if (!Array.isArray(orders)) {
        console.error('Invalid input: orders must be an array');
        return {
            '1': 0,
            '2': 0,
            '3': 0,
            'READY': 0,
            'OVERDUE': 0
        };
    }

    // Limit the number of orders to process
    const MAX_ORDERS = 10000;
    const ordersToProcess = orders.slice(0, MAX_ORDERS);
    
    if (orders.length > MAX_ORDERS) {
        console.warn(`Processing limited to ${MAX_ORDERS} orders out of ${orders.length}`);
    }

    const counts = {
        '1': 0,
        '2': 0,
        '3': 0,
        'READY': 0,
        'OVERDUE': 0
    };

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    ordersToProcess.forEach(order => {
        // Safety check for order object
        if (!order || typeof order !== 'object') return;

        const status = order.status_id?.toString();
        if (!status) return;

        if (status === '5') {
            const orderDate = new Date(order.ready_date || order.modified_at || order.created_at);
            if (orderDate < twoWeeksAgo) {
                counts.OVERDUE++;
            } else {
                counts.READY++;
            }
        } else if (counts.hasOwnProperty(status)) {
            counts[status]++;
        }
    });

    return counts;
}

// Cache results
async function cacheResults(store, data) {
    const cacheKey = `darwina_cache_${store}`;
    await chrome.storage.local.set({
        [cacheKey]: {
            data,
            timestamp: Date.now()
        }
    });
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleAsyncMessage = async (handler) => {
        try {
            const response = await handler();
            sendResponse(response);
        } catch (error) {
            console.error('Error in message handler:', error);
            sendResponse({ success: false, error: error.message });
        }
    };

    if (message.type === 'FETCH_DARWINA_DATA') {
        handleAsyncMessage(async () => {
            return await fetchDarwinaData(message.selectedStore);
        });
        return true;
    }

    if (message.type === 'CHECK_ORDERS_NOW') {
        handleAsyncMessage(async () => {
            const data = await fetchDarwinaData(message.selectedStore);
            if (data.success) {
                await chrome.storage.local.set({
                    lastUpdate: Date.now(),
                    leadCounts: data.counts
                });
            }
            return data;
        });
        return true;
    }
});
  