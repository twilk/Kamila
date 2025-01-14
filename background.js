import { getDarwinaCredentials } from './config/api.js';
import { API_CONFIG } from './config/api.js';
import { stores } from './services/stores.js';
import { UserCardService } from './services/userCard.js';
import { OrderService } from '../services/api/drwn.js';
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
import { themeService } from './services/theme.js';

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

// Nasłuchuj na instalację
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[DEBUG] 🔧 Rozpoczynam instalację rozszerzenia...');
    try {
        // Inicjalizacja i18n
        console.log('[DEBUG] 🌐 Inicjalizacja systemu tłumaczeń...');
        await i18n.init();
        await i18n.waitForTranslations();
        
        // Inicjalizacja motywu
        console.log('[DEBUG] 🎨 Inicjalizacja systemu motywów...');
        const savedTheme = await storageManager.load(STORAGE_KEYS.THEME);
        if (savedTheme) {
            themeService.applyTheme(savedTheme);
        }
        
        // Pobierz zapisane lub domyślne interwały
        const intervals = await getIntervalSettings(storageManager);
        
        // Utwórz alarmy z odpowiednimi interwałami
        await updateAlarms(intervals);
        
        console.log('[DEBUG] 🔄 Uruchamiam pierwsze sprawdzanie zamówień...');
        await checkAndUpdateOrders();
        
        // Inicjalizacja badge'a
        const selectedStore = await storageManager.load(STORAGE_KEYS.SELECTED_STORE);
        const data = await fetchAndCacheData(selectedStore);
        updateExtensionBadge(data.counts, selectedStore);
        
        console.log('[SUCCESS] ✅ Instalacja zakończona pomyślnie');
    } catch (error) {
        console.error('[ERROR] ❌ Błąd podczas instalacji:', error);
    }
});

// Utwórz alarm do pobierania danych
function createFetchAlarm() {
    chrome.alarms.create('fetchData', {
        periodInMinutes: FETCH_INTERVAL
    });
}

// Utwórz alarm do sprawdzania zamówień
function createOrderCheckAlarm() {
    chrome.alarms.create('checkOrders', {
        periodInMinutes: CHECK_INTERVAL
    });
}

// Nasłuchuj na alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('[DEBUG] ⏰ Otrzymano alarm:', alarm.name);
    
    if (alarm.name === 'fetchData') {
        console.log('[DEBUG] 📥 Obsługa alarmu fetchData...');
        // Sprawdź czy minęło 5 minut od ostatniego pobrania
        (async () => {
            try {
                const lastFetch = await storageManager.load('last_fetch_timestamp') || 0;
                const now = Date.now();
                
                if (now - lastFetch >= FETCH_INTERVAL * 60 * 1000) {
                    console.log('[DEBUG] 🔄 Rozpoczynam pobieranie danych...');
                    await fetchAndCacheData();
                    await storageManager.save('last_fetch_timestamp', now);
                    console.log('[SUCCESS] ✅ Dane pobrane i zapisane');
                } else {
                    console.log('[DEBUG] ⏳ Zbyt wcześnie na odświeżanie danych');
                }
            } catch (error) {
                console.error('[ERROR] ❌ Błąd podczas obsługi alarmu fetchData:', error);
            }
        })();
    } else if (alarm.name === 'checkOrders') {
        console.log('[DEBUG] 📦 Obsługa alarmu checkOrders...');
        checkAndUpdateOrders().catch(error => {
            console.error('[ERROR] ❌ Błąd podczas sprawdzania zamówień:', error);
        });
    }
});

// Funkcja sprawdzająca świeżość danych dla sklepu
async function isDataFresh(storeId) {
    const storeUpdates = await storageManager.load('store_updates');
    if (!storeUpdates || !storeUpdates[storeId]) {
        return false;
    }

    const storeData = storeUpdates[storeId];
    const now = Date.now();

    // Sprawdź czy dane są świeże i czy sklep był niedawno zmieniony
    return (now - storeData.lastUpdate < DATA_FRESHNESS_TIMEOUT) &&
           (now - storeData.lastStoreChange < STORE_CHANGE_TIMEOUT);
}

// Funkcja aktualizująca timestamp dla sklepu
async function updateStoreTimestamp(storeId, isStoreChange = false) {
    const storeUpdates = await storageManager.load('store_updates') || {};
    const now = Date.now();
    
    storeUpdates[storeId] = storeUpdates[storeId] || {};
    
    // Aktualizuj timestamp ostatniej aktualizacji
    storeUpdates[storeId].lastUpdate = now;
    
    // Jeśli to zmiana sklepu, zaktualizuj również timestamp zmiany
    if (isStoreChange) {
        storeUpdates[storeId].lastStoreChange = now;
    }
    
    await storageManager.save('store_updates', storeUpdates);
}

// Zmodyfikowana funkcja fetchAndCacheData
async function fetchAndCacheData(store = null) {
    try {
        // Get current store if not provided
        let storeId;
        if (!store) {
            const currentStore = await storeManager.getCurrentStore();
            storeId = currentStore?.id;
            } else {
            storeId = typeof store === 'object' ? store.id : store;
        }

        // Get store configuration if not ALL
        let storeConfig = null;
        if (storeId && storeId !== 'ALL') {
            storeConfig = await storeManager.validateStore(storeId);
            if (!storeConfig) {
                throw new Error(`Invalid store: ${storeId}`);
            }
        }

        // Get API credentials
        const credentials = await getDarwinaCredentials();
        if (!credentials) {
            throw new Error('Missing API credentials');
        }

        // Initialize OrderService
        const orderService = new OrderService(credentials);

        // Fetch all orders (with or without store filter)
        console.log(`[DEBUG] 🔄 Fetching orders${storeId ? ` for store: ${storeId}` : ''}`);
        const data = await orderService.fetchAllOrders(storeConfig);

            if (data.success) {
            // Save full data to storage
            await storageManager.save(STORAGE_KEYS.STORE_DATA(storeId), {
                orders: data.orders,
                counts: data.counts,
                timestamp: Date.now()
            });

            // Update badge with counts
            updateExtensionBadge(data.counts, storeId);
            
            console.log('[SUCCESS] ✅ Data fetched and cached successfully:', {
                store: storeId || 'ALL',
                ordersCount: data.orders?.length || 0,
                counts: data.counts
            });
        }

        return data;
        } catch (error) {
        console.error('[ERROR] ❌ Error fetching data:', error);
        throw error;
    }
}

// Nasłuchuj na zmianę sklepu
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.selectedStore) {
        const newStore = changes.selectedStore.newValue;
        if (newStore) {
            updateStoreTimestamp(newStore, true);
        }
    }
});

// Nasłuchuj na wiadomości
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[DEBUG] 📨 Otrzymano wiadomość:', message);
    
    // Ensure we keep the message channel open for async responses
    let keepChannelOpen = false;
    
    if (message.type === 'PING') {
        console.log('[DEBUG] 🏓 Otrzymano PING, odpowiadam PONG');
        sendResponse({ type: 'PONG' });
        return false; // No need to keep channel open for PING/PONG
    }

    if (message.type === 'CONNECTION_CHECK') {
        console.log('[DEBUG] 🔌 Sprawdzanie połączenia');
        sendResponse({ connected: true });
        return false;
    }
    
    // Wrapper dla asynchronicznych handlerów
    const handleAsyncMessage = async (handler) => {
        try {
            console.log('[DEBUG] 🔄 Rozpoczynam obsługę wiadomości asynchronicznej');
            keepChannelOpen = true;
            
            // Upewnij się, że tłumaczenia są załadowane
            await i18n.waitForTranslations();
            
            const response = await handler();
            console.log('[DEBUG] ✅ Wiadomość obsłużona pomyślnie:', response);
            
            if (chrome.runtime.lastError) {
                console.error('[ERROR] ❌ Błąd podczas wysyłania odpowiedzi:', chrome.runtime.lastError);
                return;
            }
            
            sendResponse(response);
        } catch (error) {
            console.error('[ERROR] ❌ Błąd w obsłudze wiadomości:', error);
            sendResponse({ 
                success: false, 
                error: error.message,
                timestamp: Date.now(),
                type: 'ERROR'
            });
        }
    };

    if (message.type === 'FETCH_DARWINA_DATA') {
        handleAsyncMessage(async () => {
            try {
                console.log('[DEBUG] 📥 Rozpoczynam pobieranie danych DARWINA');
                
                // Validate store first
                if (!message.selectedStore) {
                    throw new Error('No store selected');
                }

                // Try to get data from storage first
                const storedData = await getFromStorage(STORAGE_KEYS.STORE_DATA(message.selectedStore));
                
                if (storedData && !message.forceRefresh) {
                    console.log('[DEBUG] 📦 Zwracam dane z storage');
                    updateExtensionBadge(storedData.counts, message.selectedStore);
                    return storedData;
                }
                
                console.log('[DEBUG] 🔄 Storage pusty lub wymuszone odświeżanie, pobieram nowe dane');
                const data = await fetchAndCacheData(message.selectedStore);
                
                // Validate data before sending
                if (!data || !data.counts || !Object.values(data.counts).every(count => typeof count === 'number')) {
                    throw new Error('Invalid data received from API');
                }
                
                updateExtensionBadge(data.counts, message.selectedStore);
                return data;
            } catch (error) {
                console.error('[ERROR] ❌ Błąd podczas pobierania danych:', error);
                // Try to get last known good data
                const lastData = await getFromStorage(STORAGE_KEYS.STORE_DATA(message.selectedStore));
                if (lastData) {
                    return { ...lastData, warning: 'Using cached data due to error' };
                }
                throw error;
            }
        });
        return true; // Keep the message channel open
    }

    if (message.type === 'POPUP_OPENED') {
        handleAsyncMessage(async () => {
            try {
                console.log('[DEBUG] 📱 Popup otwarty - rozpoczynam ładowanie danych');
                
                // Pobierz aktualnie wybrany sklep
                const { selectedStore } = await chrome.storage.local.get('selectedStore');
                console.log('[DEBUG] 🏪 Wybrany sklep:', selectedStore || 'ALL');
                
                // Sprawdź dane w storage
                const storedData = await getFromStorage(STORAGE_KEYS.STORE_DATA(selectedStore));
                
                if (storedData?.success) {
                    console.log('[DEBUG] ⚡ Zwracam dane z storage');
                    return storedData;
                }

                // Jeśli brak danych w storage lub są nieaktualne, pobierz nowe
                console.log('[DEBUG] 🔄 Pobieram świeże dane z API');
                const data = await fetchAndCacheData(selectedStore);
                
                return data;
            } catch (error) {
                console.error('Error in POPUP_OPENED handler:', error);
                return { success: false, error: error.message };
            }
        });
        return true;
    }

    if (message.type === 'CHECK_ORDERS_NOW') {
        handleAsyncMessage(async () => {
            await checkAndUpdateOrders();
            const data = await fetchAndCacheData();
            await chrome.storage.local.set({ 
                lastUpdate: Date.now(),
                leadCounts: data.counts 
            });
            return { success: true, data: data.counts };
        });
        return true;
    }

    if (message.type === 'USER_DATA_COLLECTED') {
        handleUserData(message.payload);
        return false;
    }

    if (message.action === 'run-all-tests') {
        // Wysyłamy wiadomość z powrotem do popup
        // chrome.runtime.sendMessage({ 
        //     action: 'show-alert',
        //     message: 'Running all tests!'
        // });

        // Uruchom testy
        testRunner.runAll().then(results => {
            // Wyślij wyniki z powrotem do popup
            chrome.runtime.sendMessage({
                action: 'test-results',
                results: results  // Przekaż całe wyniki, nie tylko część
            });
            // Wyślij odpowiedź na oryginalną wiadomość
            sendResponse({ success: true });
        }).catch(error => {
            chrome.runtime.sendMessage({
                action: 'test-error',
                error: error.message
            });
            // Wyślij odpowiedź na oryginalną wiadomość
            sendResponse({ success: false, error: error.message });
        });
        
        return true; // Informuje Chrome, że odpowiedź będzie wysłana asynchronicznie
    }

    if (message.type === 'UPDATE_INTERVALS') {
        updateAlarms(message.intervals).catch(error => {
            console.error('Error updating alarms:', error);
        });
    }

    if (message.type === 'REFRESH_DATA_REQUEST') {
        (async () => {
            try {
                // Notify popup that refresh has started
                await sendMessageToPopup('REFRESH_STATUS', { 
                    payload: { status: 'started' }
                });
                
                // Clear cache and timestamps
                await chrome.storage.local.remove([
                    'last_fetch_time',
                    'last_full_update',
                    'leadCounts',
                    'store_updates'
                ]);
                
                // Force a full data refresh
                const { selectedStore } = await chrome.storage.local.get('selectedStore');
                const data = await fetchAndCacheData(selectedStore);
                
                // Update badge and storage
                updateExtensionBadge(data.counts, selectedStore);
                await chrome.storage.local.set({ 
                    lastUpdate: Date.now(),
                    leadCounts: data.counts 
                });
                
                // Notify popup that refresh is complete
                await sendMessageToPopup('REFRESH_STATUS', { 
                    payload: { status: 'completed' }
                });
                
                // Send response back to the popup
                sendResponse({ success: true, data: data.counts });
            } catch (error) {
                // Notify popup of failure
                await sendMessageToPopup('REFRESH_STATUS', { 
                    payload: { 
                        status: 'failed',
                        error: error.message 
                    }
                });
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep the message channel open
    }

    if (message.type === 'CONNECTION_CHECK') {
        sendResponse({ connected: true });
        return true; // Keep the message channel open for the async response
    }

    if (message.type === 'PING') {
        sendResponse({ type: 'PONG' });
        return true;
    }

    return keepChannelOpen; // Return true only if we need to keep the channel open
});

// Handler dla FETCH_DARWINA_DATA
async function handleFetchDarwinaData(message) {
    const { selectedStore } = message;
    return await fetchAndCacheData(selectedStore);
}

// Funkcja wysyłania logów - tylko do konsoli
function sendLogToPopup(message, type = 'info', data = null) {
    const timestamp = new Date().toLocaleTimeString();
    // Zawsze loguj do konsoli, nie próbuj wysyłać do popup
    if (data) {
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    }
}

// Funkcja bezpiecznego wysyłania wiadomości
async function sendMessageToPopup(type, payload) {
    try {
        // Check if popup exists before sending
        const popupExists = await new Promise(resolve => {
            chrome.runtime.getContexts({ contextTypes: ['POPUP'] }, contexts => {
                resolve(contexts.length > 0);
            });
        });

        if (!popupExists) {
            console.log('[INFO] Popup is closed, skipping message:', { type, payload });
            return null;
        }

        return await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type, payload }, response => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    console.log('[WARNING] Message sending failed:', lastError);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.log('[ERROR] Error sending message:', error);
        return null;
    }
}

// Handler dla USER_DATA_COLLECTED
async function handleUserData(userData) {
    if (!userData || !userData.memberId) return;
    
    try {
        // Używamy nowej funkcji do wysyłania wiadomości
        await sendMessageToPopup('USER_CHANGED', userData.memberId);
    } catch (error) {
        console.error('Error handling user data:', error);
    }
}

// Bezpieczna wersja handlePopupOpened
async function handlePopupOpened() {
    const selectedStore = await storageManager.load(STORAGE_KEYS.SELECTED_STORE);
    const data = await fetchAndCacheData(selectedStore);
    return { data, selectedStore };
}

// Bezpieczna wersja handleCheckOrdersNow
async function handleCheckOrdersNow() {
        await checkAndUpdateOrders();
    return { success: true };
}

// Funkcja do pobierania danych z API
async function fetchDarwinaData(darwinaConfig, selectedStore) {
    try {
        // Wyślij informację o rozpoczęciu zadania
        await sendMessageToPopup('PROGRESS_UPDATE', {
            type: 'START_TASK',
            data: {
                taskName: 'Pobieranie danych',
                totalSteps: 1
            }
        });

        // Sprawdź timestamp ostatniego pełnego update'u
        const last_full_update = await storageManager.load('last_full_update');
        const isFirstRun = !last_full_update;

        let result;
        if (isFirstRun) {
            await sendMessageToPopup('PROGRESS_UPDATE', {
                type: 'UPDATE_STATUS',
                data: { status: 'Pierwsze uruchomienie - pobieram pełne dane...' }
            });
            result = await fetchFullData(darwinaConfig, selectedStore);
        } else {
            await sendMessageToPopup('PROGRESS_UPDATE', {
                type: 'UPDATE_STATUS',
                data: { status: 'Pobieram zmiany od ostatniej aktualizacji...' }
            });
            try {
                result = await fetchIncrementalData(darwinaConfig, selectedStore, last_full_update);
            } catch (error) {
                console.error('Failed incremental update, falling back to full fetch:', error);
                await sendMessageToPopup('PROGRESS_UPDATE', {
                    type: 'UPDATE_STATUS',
                    data: { status: 'Błąd aktualizacji przyrostowej - pobieram pełne dane...' }
                });
                result = await fetchFullData(darwinaConfig, selectedStore);
            }
        }

        // Zapisz timestamp pełnego update'u
        await storageManager.save('last_full_update', Date.now());

        // Informuj o zakończeniu
        await sendMessageToPopup('PROGRESS_UPDATE', {
            type: 'SUCCESS',
            data: {
                message: `Pobrano ${result.totalOrders} zamówień`
            }
        });

        return result;

    } catch (error) {
        await sendMessageToPopup('PROGRESS_UPDATE', {
            type: 'ERROR',
            data: {
                message: `Błąd podczas pobierania danych: ${error.message}`
            }
        });
        throw error;
    }
}

// Funkcja pobierająca dane przyrostowo
async function fetchIncrementalData(storeId, lastFullUpdate, signal) {
    const store = await storeManager.validateStore(storeId);
    if (!store.drwn) {
        throw new Error(`Store ${storeId} has no API configuration`);
    }

    const darwinaConfig = await getDarwinaCredentials();
    const orderService = new OrderService();
    await orderService.initialize(darwinaConfig);

    const data = await orderService.fetchIncrementalLeadCounts(store.drwn, lastFullUpdate, signal);
    
    if (data.success) {
        await storageManager.save(STORAGE_KEYS.STORE_DATA(storeId), data);
        await updateStoreTimestamp(storeId);
        updateExtensionBadge(data.counts, storeId);
    }

    return data;
}

// Funkcja pobierająca pełne dane
async function fetchFullData(storeId, signal) {
    const store = await storeManager.validateStore(storeId);
    if (!store.drwn) {
        throw new Error(`Store ${storeId} has no API configuration`);
    }

    const darwinaConfig = await getDarwinaCredentials();
    const orderService = new OrderService();
    await orderService.initialize(darwinaConfig);

    const data = await orderService.fetchLeadCounts(store.drwn, signal);
    
    if (data.success) {
        await storageManager.save(STORAGE_KEYS.STORE_DATA(storeId), data);
        await updateStoreTimestamp(storeId);
        updateExtensionBadge(data.counts, storeId);
    }

    return data;
}

async function fetchOrdersByStatus(darwinaConfig, statusGroup, selectedStore, lastUpdate = null, signal) {
    const baseParams = new URLSearchParams();
    baseParams.append('status_id', statusGroup);
    baseParams.append('limit', '50');

    if (selectedStore && selectedStore !== 'ALL') {
        const store = stores.find(s => s.id === selectedStore);
        if (!store) {
            throw new Error(`Nie znaleziono sklepu o ID: ${selectedStore}`);
        }
        baseParams.append('delivery_id', store.deliveryId.toString());
    }

    if (lastUpdate) {
        baseParams.append('modified_from', new Date(lastUpdate).toISOString());
    }

    let allOrders = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
        baseParams.set('page', currentPage.toString());
        const requestUrl = `${darwinaConfig.DARWINA_API_BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?${baseParams.toString()}`;

        console.log('[DEBUG] 🔍 Wysyłam zapytanie:', {
            url: requestUrl,
            page: currentPage,
            params: Object.fromEntries(baseParams.entries())
        });

        const response = await fetch(requestUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ERROR] 🔥 Błąd API:', {
                status: response.status,
                url: requestUrl,
                error: errorText
            });
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Sprawdź strukturę odpowiedzi
        if (!data || !data.data || !Array.isArray(data.data)) {
            console.error('[ERROR] 🔥 Nieprawidłowa struktura odpowiedzi:', data);
            throw new Error('Invalid API response structure');
        }

        totalPages = data.__metadata?.page_count || 1;
        allOrders = [...allOrders, ...data.data];

        console.log(`[INFO] 📦 Pobrano stronę ${currentPage}/${totalPages} (${data.data.length} zamówień)`);
        currentPage++;
    } while (currentPage <= totalPages);

    console.log(`[SUCCESS] ✅ Pobrano łącznie ${allOrders.length} zamówień`);
    return allOrders;
}

// Funkcja do przetwarzania danych z postępem
async function processDataWithProgress(allOrders, selectedStore, isFirstRun) {
    try {
        // Validate input data
        if (!Array.isArray(allOrders)) {
            console.error('[ERROR] 🔥 Nieprawidłowy format danych:', allOrders);
            throw new Error('Invalid orders data format: expected array');
        }

        // Validate each order
        const invalidOrders = [];
        const validOrders = allOrders.filter(order => {
            // Basic structure check
            if (!order || typeof order !== 'object') {
                invalidOrders.push({ order, reason: 'Invalid order structure' });
                return false;
            }

            // Check required fields
            if (!order.id) {
                invalidOrders.push({ order, reason: 'Missing order ID' });
                return false;
            }

            // Validate status_id
            const status = order.status_id?.toString();
            if (!status || !['1', '2', '3', '5'].includes(status)) {
                invalidOrders.push({ order, reason: `Invalid status_id: ${status}` });
                return false;
            }

            // For status 5, check date fields
            if (status === '5') {
                const orderDate = order.ready_date || order.status_change_date || order.modified_at || order.created_at;
                if (!orderDate) {
                    invalidOrders.push({ order, reason: 'Missing date for status 5' });
                    return false;
                }
                try {
                    new Date(orderDate.replace(' ', 'T'));
                } catch (e) {
                    invalidOrders.push({ order, reason: `Invalid date format: ${orderDate}` });
                    return false;
                }
            }

            return true;
        });

        if (invalidOrders.length > 0) {
            console.log('[WARNING] ⚠️ Znaleziono nieprawidłowe zamówienia:', {
                total: allOrders.length,
                valid: validOrders.length,
                invalid: invalidOrders.length,
                examples: invalidOrders.slice(0, 3)
            });
        }

        // Clear old data first
        if (isFirstRun) {
            await chrome.storage.local.remove(['leadCounts', 'last_full_update']);
            console.log(`[DEBUG] 📥 Pierwsze uruchomienie - zapisuję ${validOrders.length} zamówień`);
        } else {
            // For incremental updates, get existing data
            const storedData = await getFromStorage(STORAGE_KEYS.STORE_DATA(selectedStore));

            // Validate stored data
            if (storedData?.orders && !Array.isArray(storedData.orders)) {
                console.error('[ERROR] 🔥 Nieprawidłowe dane w storage:', storedData);
                throw new Error('Invalid stored data format');
            }

            if (storedData && storedData.orders) {
                // Create map of existing orders
                const ordersMap = new Map(storedData.orders.map(order => [order.id, order]));
                
                let updateCount = 0;
                let newCount = 0;
                let unchangedCount = 0;
                
                // Update or add new orders
                validOrders.forEach(order => {
                    const existingOrder = ordersMap.get(order.id);
                    if (existingOrder) {
                        // Check if order actually changed
                        if (JSON.stringify(existingOrder) !== JSON.stringify(order)) {
                            updateCount++;
                            ordersMap.set(order.id, order);
                        } else {
                            unchangedCount++;
                        }
                    } else {
                        newCount++;
                        ordersMap.set(order.id, order);
                    }
                });
                
                validOrders = Array.from(ordersMap.values());
                console.log(`[DEBUG] 🔄 Aktualizacja przyrostowa:
                    - Zaktualizowano: ${updateCount} zamówień
                    - Dodano nowych: ${newCount} zamówień
                    - Bez zmian: ${unchangedCount} zamówień
                    - Łącznie: ${validOrders.length} zamówień`);
            }
        }

        // Process orders and count statuses
        const statusCounts = processOrders(validOrders);

        // Save processed data
        const result = {
            success: true,
            counts: statusCounts,
            totalOrders: validOrders.length,
            store: selectedStore || 'ALL',
            orders: validOrders,
            timestamp: Date.now()
        };

        // Save to storage
        await saveToStorage(STORAGE_KEYS.STORE_DATA(selectedStore), result);
        
        return result;
    } catch (error) {
        console.error('[ERROR] 🔥 Błąd podczas przetwarzania danych:', error);
        throw error;
    }
}

// Helper function to validate status counts
function validateStatusCounts(counts) {
    const requiredStatuses = ['1', '2', '3', 'READY', 'OVERDUE'];
    return counts && 
           typeof counts === 'object' &&
           requiredStatuses.every(status => 
               counts.hasOwnProperty(status) && 
               typeof counts[status] === 'number' &&
               counts[status] >= 0
           );
}

// Funkcja do przetwarzania zamówień i liczenia statusów
export function processOrders(orders) {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const totalOrders = orders.length;
    let processedCount = 0;
    
    console.log(`[DEBUG] 📊 Rozpoczynam analizę ${totalOrders} zamówień`);

    // Inicjalizacja liczników dla wszystkich możliwych statusów
    const statusCounts = {
        '1': 0,  // SUBMITTED
        '2': 0,  // CONFIRMED
        '3': 0,  // ACCEPTED
        'READY': 0,
        'OVERDUE': 0
    };

    orders.forEach(order => {
        processedCount++;
        if (processedCount % 10 === 0) {
            console.log(`[DEBUG] 🔄 Przetworzono ${processedCount}/${totalOrders} zamówień`);
        }

        // Sprawdź czy order i status_id istnieją
        if (!order || !order.status_id) {
            console.log(`[WARNING] ⚠️ Nieprawidłowe dane zamówienia:`, order);
            return;
        }

        const status = order.status_id.toString();
        
        // Dla statusu READY (5) używamy ready_date lub status_change_date
        const orderDate = status === '5' ? 
            (order.ready_date || order.status_change_date || order.modified_at || order.created_at) : 
            (order.modified_at || order.created_at);
            
        const parsedDate = orderDate ? new Date(orderDate.replace(' ', 'T')) : null;

        if (status === '5' && !parsedDate) {
            console.log(`[WARNING] ⚠️ Brak daty dla zamówienia gotowego do odbioru ${order.id}`);
            return;
        }

        // Zliczaj zamówienia na podstawie status_id
        const parsedStatus = parseInt(status);
        switch (parsedStatus) {
            case 1: // SUBMITTED
                statusCounts['1']++;
                break;
            case 2: // CONFIRMED
                statusCounts['2']++;
                break;
            case 3: // ACCEPTED_STORE
                statusCounts['3']++;
                break;
            case 5: // READY
                if (parsedDate && parsedDate < twoWeeksAgo) {
                    statusCounts['OVERDUE']++;
                } else {
                    statusCounts['READY']++;
                }
                break;
            default:
                console.log(`[WARNING] ⚠️ Nieznany status ${parsedStatus} dla zamówienia ${order.id}`);
        }
    });

    console.log('[DEBUG] 🔍 Debug statusów:', {
        rawCounts: statusCounts,
        totalOrders: totalOrders
    });

    console.log(`[DEBUG] 📊 Podsumowanie statusów:`, statusCounts);
    console.log(`[DEBUG] ✅ Zakończono analizę wszystkich ${totalOrders} zamówień`);

    return statusCounts;
}

function getCacheKey(selectedStore) {
    return `${CACHE_KEY}_${selectedStore || 'ALL'}`;
}

// Funkcja sprawdzająca i aktualizująca zamówienia
async function checkAndUpdateOrders(store = null) {
    try {
        // Get store configuration
        if (!store) {
            store = await storeManager.getSelectedStore();
        }

        if (!store) {
            console.log('[INFO] ℹ️ No store selected, initializing default');
            // Initialize with default store if none selected
            await storeManager.initialize();
            return;
        }

        console.log('[INFO] 📦 Checking orders for store:', store.id);
        
        // Initialize OrderService with credentials
        const credentials = await getDarwinaCredentials();
        const orderService = new OrderService(credentials);
        
        // Fetch and process orders
        const result = await orderService.fetchAllOrders(store);
        if (!result.success) {
            throw new Error('Failed to fetch orders');
        }

        // Update badge with new counts
        await updateBadge(result.counts);

        // Save the data
        await storageManager.save(`data_${store.id}`, {
            orders: result.orders,
            counts: result.counts,
            timestamp: Date.now()
        });

        console.log('[SUCCESS] ✅ Orders updated successfully');
    } catch (error) {
        console.error('[ERROR] ❌ Failed to check and update orders:', error);
    }
}

// Nasłuchuj na uruchomienie rozszerzenia
chrome.runtime.onStartup.addListener(async () => {
    console.log('[DEBUG] 🚀 Rozpoczynam uruchamianie rozszerzenia...');
    try {
        // Inicjalizacja motywu
        console.log('[DEBUG] 🎨 Inicjalizacja systemu motywów...');
        const savedTheme = await storageManager.load(STORAGE_KEYS.THEME);
        if (savedTheme) {
            themeService.applyTheme(savedTheme);
        }
        
        console.log('[DEBUG] ⚙️ Tworzę alarm do sprawdzania zamówień...');
        await createOrderCheckAlarm();
        
        console.log('[DEBUG] 🔄 Uruchamiam pierwsze sprawdzanie zamówień...');
        await checkAndUpdateOrders();
        
        console.log('[SUCCESS] ✅ Uruchomienie zakończone pomyślnie');
    } catch (error) {
        console.error('[ERROR] ❌ Błąd podczas uruchamiania:', error);
    }
});

// Funkcja aktualizująca badge na ikonie
function updateExtensionBadge(counts, storeId) {
    if (!counts) return;

    // Calculate total count
    const totalCount = Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);

    // Update badge text
    if (totalCount > 0 && storeId) {
        chrome.action.setBadgeText({ text: totalCount.toString() });
        
        // Set badge color (red if overdue orders exist)
        const hasOverdue = counts['OVERDUE'] > 0;
        chrome.action.setBadgeBackgroundColor({
            color: hasOverdue ? '#dc3545' : '#28a745'
        });
    } else {
        // Hide badge if no orders or no store selected
        chrome.action.setBadgeText({ text: '' });
    }
}

// Funkcja do sprawdzania nowych zamówień w tle
async function checkNewOrders(selectedStore) {
    try {
        const lastCheckTime = await storageManager.load('last_check_time');
        const now = Date.now();
        
        // Upewnij się, że mamy prawidłowe ID sklepu
        const storeId = selectedStore?.id || selectedStore;
        
        // Pobierz tylko zamówienia zmodyfikowane od ostatniego sprawdzenia
        const orders = await fetchOrdersByStatus(
            await getDarwinaCredentials(),
            '1', // Status SUBMITTED
            storeId,
            lastCheckTime
        );

        // Aktualizuj czas ostatniego sprawdzenia
        await storageManager.save('last_check_time', now);

        // Pokaż powiadomienia dla nowych zamówień
        for (const order of orders) {
            await createOrderNotification(order, '1');
        }

        // Aktualizuj badge
        if (orders.length > 0) {
            const leadCounts = await storageManager.load('leadCounts');
            const newCounts = {
                ...leadCounts,
                '1': (leadCounts?.['1'] || 0) + orders.length
            };
            await updateLeadCounts(newCounts);
            updateExtensionBadge(newCounts, storeId);
        }

    } catch (error) {
        console.error('Error checking new orders:', error);
    }
}

// Funkcja do aktualizacji liczników
async function updateLeadCounts(newCounts) {
    try {
        if (!newCounts || typeof newCounts !== 'object') {
            console.error('[ERROR] ❌ Invalid counts data:', newCounts);
            return;
        }

        // Get current store context
        const selectedStore = await storageManager.load(STORAGE_KEYS.SELECTED_STORE);
        if (!selectedStore) {
            console.error('[ERROR] ❌ No store selected');
            return;
        }

        // Get previous counts for comparison
        const oldCounts = await storageManager.load('leadCounts');

        // Save new counts with store context
        await storageManager.save('leadCounts', newCounts);
        await storageManager.save('lastUpdate', Date.now());

        // Check if there are significant changes in counts
        let hasSignificantChanges = false;
        if (oldCounts) {
            Object.entries(newCounts).forEach(([status, count]) => {
                const oldCount = oldCounts[status] || 0;
                if (count !== oldCount) {
                    hasSignificantChanges = true;
                }
            });
        } else {
            hasSignificantChanges = true;
        }

        // Emit counts updated event if there are changes
        if (hasSignificantChanges) {
            chrome.runtime.sendMessage({
                type: 'COUNTS_UPDATED',
                payload: {
                    counts: newCounts,
                    store: selectedStore,
                    timestamp: Date.now()
                }
            }).catch(error => {
                console.warn('[WARNING] ⚠️ Error sending COUNTS_UPDATED message:', error);
            });
        }

    } catch (error) {
        console.error('[ERROR] ❌ Error in updateLeadCounts:', error);
    }
}

// Update port connection handling
chrome.runtime.onConnect.addListener((port) => {
    console.log('[INFO] 🔌 New port connection:', port.name);
    
    const messageHandler = async (message) => {
        console.log('[DEBUG] 📨 Received port message:', message);
        
        let response = null;
        
        try {
            if (message.type === 'PING') {
                response = { type: 'PONG' };
            } else if (message.type === 'CONNECTION_CHECK') {
                response = { connected: true };
            } else if (message.type === 'FETCH_DARWINA_DATA') {
                response = await handleFetchDarwinaData(message);
            } else if (message.type === 'POPUP_OPENED') {
                response = await handlePopupOpened();
            } else if (message.type === 'CHECK_ORDERS_NOW') {
                response = await handleCheckOrdersNow();
            }
            
            if (response) {
                // Check if port is still connected before sending
                if (port.error) {
                    console.warn('[WARNING] ⚠️ Port disconnected, cannot send response');
                    return;
                }
                port.postMessage(response);
            }
        } catch (error) {
            console.error('[ERROR] ❌ Error handling message:', error);
            // Send error response if port is still connected
            if (!port.error) {
                port.postMessage({ 
                    error: error.message,
                    timestamp: Date.now(),
                    type: 'ERROR'
                });
            }
        }
    };

    port.onMessage.addListener(messageHandler);

    port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        if (error) {
            console.warn('[WARNING] ⚠️ Port disconnected with error:', error);
        }
        port.onMessage.removeListener(messageHandler);
        console.log('[INFO] 🔌 Port disconnected:', port.name);
    });
});

// Initialize extension
async function initializeExtension() {
    try {
        // Get interval settings
        const intervals = await getIntervalSettings(storageManager);
        
        // Set up alarms
        await chrome.alarms.create('fetchData', {
            periodInMinutes: intervals.fullRefresh
        });
        
        await chrome.alarms.create('checkOrders', {
            periodInMinutes: intervals.backgroundCheck
        });

        console.log('[SUCCESS] ✅ Extension initialized successfully');
    } catch (error) {
        console.error('[ERROR] ❌ Błąd podczas instalacji:', error);
    }
}
  