import { getDarwinaCredentials } from './config/api.js';
import { API_CONFIG } from './config/api.js';
import { stores } from './services/stores.js';
import { UserCardService } from './services/userCard.js';
import { OrderService } from './services/api/OrderService.js';
import { STORAGE_KEYS } from './config/storage.js';
import { storageManager } from './services/storage.js';
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
    constructor() {
        this.notificationHistory = [];
        this.lastNotificationTime = 0;
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
}

// Inicjalizacja managera powiadomień
const notificationManager = new NotificationManager();
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
    notification: new NotificationManager()
};

// Core managers
const managers = {
    theme: new ThemeManager(),
    cache: new CacheManager(),
    ui: new UIManager(),
    data: new DataManager(),
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

// Handle browser startup
chrome.runtime.onStartup.addListener(async () => {
    try {
        console.log('[DEBUG] 🚀 Browser started');
        
        // Initialize services
        await initializeServices();
        
        // Initialize managers using InitializationManager
        await initManager.initializeOnStartup();
        
        // Create alarms
        await createOrderCheckAlarm();
        console.log('[DEBUG] ⏰ Order check alarm created');
    } catch (error) {
        console.error('[ERROR] ❌ Startup failed:', error);
    }
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(async () => {
    try {
        console.log('[DEBUG] 🚀 Extension installed/updated');
        
        // Initialize services
        await initializeServices();
        
        // Initialize managers using InitializationManager
        await initManager.initializeOnInstall();

        // Set default preferences
        await chrome.storage.local.set({
            useSystemTheme: true,
            theme: 'light',
            refreshInterval: DEFAULT_INTERVALS.fullRefresh
        });
        console.log('[DEBUG] ⚙️ Default preferences set');

        // Initialize i18n separately as it has special requirements
        await i18n.init();
        console.log('[DEBUG] 🌐 i18n system initialized');

    } catch (error) {
        console.error('[ERROR] ❌ Installation failed:', error);
    }
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('[DEBUG] ⏰ Otrzymano alarm:', alarm.name);
    
    try {
        switch (alarm.name) {
            case 'checkOrders':
                console.log('[DEBUG] 📦 Obsługa alarmu checkOrders...');
                await checkAndUpdateOrders();
                break;
                
            case 'checkNewOrders':
                await checkAndUpdateOrders();
                break;
        }
    } catch (error) {
        console.error(`[ERROR] ❌ Failed to handle alarm ${alarm.name}:`, error);
    }
});

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

// API handling
async function fetchDarwinaData(store = 'ALL') {
    try {
        const darwinaConfig = await getDarwinaCredentials();
        if (!darwinaConfig) {
            throw new Error('Brak konfiguracji API');
        }

        let allOrders = [];
        const statusGroups = ['1', '2', '3', '5'];
        
        // Fetch orders for each status
        for (const status of statusGroups) {
            const params = new URLSearchParams({
                status_id: status
            });

            if (store !== 'ALL') {
                params.append('delivery_id', store);
            }

            const response = await fetch(`${API_CONFIG.baseUrl}/orders?${params}`, {
                headers: {
                    'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            allOrders = allOrders.concat(data.orders || []);
        }

        // Process orders and count statuses
        const counts = processOrders(allOrders);
        
        // Cache the results
        await cacheResults(store, { counts, orders: allOrders });

        return {
            success: true,
            counts,
            orders: allOrders
        };
    } catch (error) {
        console.error('Error fetching Darwina data:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Process orders and count statuses
function processOrders(orders) {
    const counts = {
        '1': 0,
        '2': 0,
        '3': 0,
        'ready': 0,
        'overdue': 0
    };

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    orders.forEach(order => {
        const status = order.status_id?.toString();
        if (!status) return;

        if (status === '5') {
            const orderDate = new Date(order.ready_date || order.modified_at || order.created_at);
            if (orderDate < twoWeeksAgo) {
                counts.overdue++;
            } else {
                counts.ready++;
            }
        } else if (status in counts) {
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
  