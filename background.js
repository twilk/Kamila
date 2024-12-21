import { getDarwinaCredentials } from './config/api.js';
import { CacheService } from './services/cache.js';
import { API_CONFIG } from './config/api.js';
import { stores } from './config/stores.js';
import { UserCardService } from './services/userCard.js';
import { performanceHandler } from './performance-handler';
import { CACHE_CONFIG } from './config/cache.config.js';
import { N8nService } from './services/n8n.service.js';
import { NotificationService } from './services/notification.service.js';
import { i18n } from './locales/i18n.js';

const FETCH_INTERVAL = 5; // minutes
const CACHE_KEY = 'darwina_orders_data';

// Nasłuchuj na instalację
chrome.runtime.onInstalled.addListener(() => {
    createFetchAlarm();
});

// Utwórz alarm do pobierania danych
function createFetchAlarm() {
    chrome.alarms.create('fetchData', {
        periodInMinutes: FETCH_INTERVAL
    });
}

// Nasłuchuj na alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'fetchData') {
        // Sprawdź czy minęło 5 minut od ostatniego pobrania
        const lastFetchKey = 'last_fetch_timestamp';
        chrome.storage.local.get(lastFetchKey, async (result) => {
            const lastFetch = result[lastFetchKey] || 0;
            const now = Date.now();
            
            if (now - lastFetch >= FETCH_INTERVAL * 60 * 1000) {
                await fetchAndCacheData();
                chrome.storage.local.set({ [lastFetchKey]: now });
            }
        });
    }
    if (alarm.name === 'cacheCleanup') {
        CacheService.cleanup();
    }
    if (alarm.name === 'n8nStatusCheck') {
        N8nService.checkStatus()
            .then(status => {
                if (!status.ok) {
                    console.warn('N8N service status check failed:', status);
                }
            })
            .catch(error => {
                console.error('N8N status check error:', error);
            });
    }
});

// Funkcja do pobierania i cachowania danych
async function fetchAndCacheData(selectedStore) {
    try {
        sendLogToPopup('🔄 Rozpoczynam pobieranie danych', 'info');
        const darwinaConfig = await getDarwinaCredentials();
        const data = await fetchDarwinaData(darwinaConfig, selectedStore);
        if (data.success) {
            await CacheService.set(getCacheKey(selectedStore), data);
            sendLogToPopup('✅ Dane zapisane w cache', 'success');
        }
        return data;
    } catch (error) {
        sendLogToPopup('❌ Błąd pobierania danych', 'error', error.message);
        throw error;
    }
}

// Nasłuchuj na wiadomości
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_DARWINA_DATA') {
        (async () => {
            try {
                const cacheKey = getCacheKey(message.selectedStore);
                // Najpierw sprawdź cache
                const cachedData = await CacheService.get(cacheKey);
                if (cachedData) {
                    sendLogToPopup('📦 Zwracam dane z cache', 'info');
                    sendResponse(cachedData);
                    return;
                }

                // Jeśli brak cache, pobierz nowe dane
                sendLogToPopup('🔄 Cache pusty, pobieram nowe dane', 'info');
                const data = await fetchAndCacheData(message.selectedStore);
                sendResponse(data);
            } catch (error) {
                sendLogToPopup('❌ Błąd', 'error', error.message);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    if (message.type === 'USER_DATA_COLLECTED') {
        handleUserData(message.payload);
    }
    if (message.type === 'N8N_WORKFLOW') {
        (async () => {
            try {
                const result = await N8nService.triggerWorkflow(message.data);
                sendResponse({ success: true, data: result });
            } catch (error) {
                console.error('N8N workflow error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep message channel open
    }
    switch (message.type) {
        case 'PERFORMANCE_METRIC':
            performanceHandler.handleMetric(message.payload);
            break;
            
        case 'PERFORMANCE_VIOLATION':
            performanceHandler.handleViolation(message.payload);
            break;
            
        case 'GET_PERFORMANCE_REPORT':
            sendResponse(performanceHandler.getReport());
            break;
    }
    return true;
});

// Funkcja do pobierania danych z API
async function fetchDarwinaData(darwinaConfig, selectedStore) {
    let allOrders = [];
    
    // Definiujemy grupy statusów
    const statusGroups = ['1', '2', '3', '5']; // Używamy stringów dla API

    // Log the status groups we're fetching
    sendLogToPopup('📋 Pobieranie danych dla statusów:', 'info', statusGroups);

    // Dla każdej grupy statusów wykonaj osobne zapytanie
    for (const statusGroup of statusGroups) {
        let currentPage = 1;
        let totalPages = 1;
        
        // Przygotuj parametry dla danej grupy statusów
        const baseParams = new URLSearchParams();
        baseParams.append('status_id', statusGroup);
        baseParams.append('limit', '50');

        // Dodaj filtr sklepu
        if (selectedStore && selectedStore !== 'ALL') {
            const store = stores.find(s => s.id === selectedStore);
            if (!store) {
                throw new Error(`Nie znaleziono sklepu o ID: ${selectedStore}`);
            }
            
            // Filtruj po delivery_id
            baseParams.append('delivery_id', store.deliveryId.toString());
            
            // Dodaj filtrowanie po punkcie odbioru
            if (store.address) {
                baseParams.append('client_comment', `Punkt odbioru: ${store.address}`);
            }
        }

        // Pobierz wszystkie strony dla danego statusu
        do {
            baseParams.set('page', currentPage.toString());
            const requestUrl = `${darwinaConfig.DARWINA_API_BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?${baseParams.toString()}`;
            
            sendLogToPopup('🔍 Wysyłam zapytanie dla statusu ' + statusGroup, 'info', {
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
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            totalPages = data.__metadata?.page_count || 1;

            if (data.data && Array.isArray(data.data)) {
                allOrders = [...allOrders, ...data.data];
                sendLogToPopup(`📦 Pobrano dane (strona ${currentPage}/${totalPages})`, 'info');
            }

            currentPage++;
        } while (currentPage <= totalPages);
    }

    // Przetwórz wszystkie zebrane zamówienia
    const statusCounts = processOrders(allOrders);

    const result = {
        success: true,
        counts: {
            '1': statusCounts['1'] || 0,
            '2': statusCounts['2'] || 0,
            '3': statusCounts['3'] || 0,
            'READY': statusCounts['READY'] || 0,
            'OVERDUE': statusCounts['OVERDUE'] || 0
        },
        totalOrders: allOrders.length,
        store: selectedStore || 'ALL'
    };

    // Add debug logging for final result
    sendLogToPopup('🔍 Końcowy wynik:', 'info', result);

    return result;
}

// Funkcja do przetwarzania zamówień i liczenia statusów
function processOrders(orders) {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const totalOrders = orders.length;
    
    sendLogToPopup(`📊 Rozpoczynam analizę ${totalOrders} zamówień`, 'info');
    let processedCount = 0;

    const statusCounts = orders.reduce((acc, order) => {
        processedCount++;
        if (processedCount % 10 === 0) {
            sendLogToPopup(`�� Przetworzono ${processedCount}/${totalOrders} zamówień`, 'info');
        }

        const status = order.status_id;
        
        // Dla statusu READY (5) używamy ready_date lub status_change_date
        const orderDate = status === '5' ? 
            (order.ready_date || order.status_change_date) : 
            order.date;
            
        const parsedDate = orderDate ? new Date(orderDate.replace(' ', 'T')) : null;

        if (status === '5' && !parsedDate) {
            sendLogToPopup(`⚠️ Brak daty dla zamówienia gotowego do odbioru ${order.id}`, 'warning');
            return acc;
        }

        if (status) {
            const parsedStatus = parseInt(status);
            switch (parsedStatus) {
                case 1: // SUBMITTED
                    acc['1'] = (acc['1'] || 0) + 1;
                    sendLogToPopup(`📝 Zamówienie ${order.id} - status: Złożone`, 'debug');
                    break;
                case 2: // CONFIRMED
                    acc['2'] = (acc['2'] || 0) + 1;
                    sendLogToPopup(`✓ Zamówienie ${order.id} - status: Potwierdzone`, 'debug');
                    break;
                case 3: // ACCEPTED_STORE
                    acc['3'] = (acc['3'] || 0) + 1;
                    sendLogToPopup(`🏪 Zamówienie ${order.id} - status: Przyjęte`, 'debug');
                    break;
                case 5: // READY
                    if (parsedDate < twoWeeksAgo) {
                        acc['OVERDUE'] = (acc['OVERDUE'] || 0) + 1;
                        sendLogToPopup(`⏳ Zamówienie ${order.id} oznaczone jako przeterminowane (data: ${orderDate})`, 'debug');
                    } else {
                        acc['READY'] = (acc['READY'] || 0) + 1;
                        sendLogToPopup(`📦 Zamówienie ${order.id} - status: Gotowe do odbioru`, 'debug');
                    }
                    break;
                default:
                    sendLogToPopup(`⚠️ Nieznany status ${parsedStatus} dla zamówienia ${order.id}`, 'warning');
            }
        }
        return acc;
    }, {});

    // Log końcowych wyników
    const results = {
        '1': statusCounts['1'] || 0,
        '2': statusCounts['2'] || 0,
        '3': statusCounts['3'] || 0,
        'READY': statusCounts['READY'] || 0,
        'OVERDUE': statusCounts['OVERDUE'] || 0
    };

    // Add debug logging for each status
    sendLogToPopup('🔍 Debug statusów:', 'info', {
        rawCounts: statusCounts,
        processedCounts: results,
        totalOrders: totalOrders
    });

    sendLogToPopup(`📊 Podsumowanie statusów:`, 'info', results);
    sendLogToPopup(`✅ Zakończono analizę wszystkich ${totalOrders} zamówień`, 'success');

    return statusCounts;
}

// Funkcja wysyłania logów do popup
function sendLogToPopup(message, type = 'info', data = null) {
    chrome.runtime.sendMessage({
        type: 'LOG_MESSAGE',
        payload: {
            message,
            type,
            data
        }
    });
}

function getCacheKey(selectedStore) {
    return `${CACHE_KEY}_${selectedStore || 'ALL'}`;
}

// Funkcja obsługująca zebrane dane użytkownika
async function handleUserData(userData) {
    if (!userData || !userData.memberId) return;
    
    try {
        const isNewQRCode = await UserCardService.saveUserData(userData);
        await UserCardService.setCurrentUser(userData.memberId);
        
        if (isNewQRCode && !userData.notificationShown) {
            // Pokaż systemowe powiadomienie
            chrome.notifications.create(`qr-import-${userData.memberId}`, {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: 'Kamila - Import QR kodu',
                message: `QR kod użytkownika ${userData.firstName} został pomyślnie zaimportowany.`,
                priority: 2
            });
            
            // Oznacz powiadomienie jako wyświetlone
            await UserCardService.markNotificationShown(userData.memberId);
        }

        chrome.runtime.sendMessage({
            type: 'USER_CHANGED',
            payload: userData.memberId
        });

    } catch (error) {
        console.error('Error handling user data:', error);
        sendLogToPopup('❌ Błąd zapisywania danych użytkownika', 'error', error.message);
    }
}

// Dodaj obsługę kliknięcia w powiadomienie
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('qr-import-')) {
        // Otwórz popup po kliknięciu w powiadomienie
        chrome.action.openPopup();
    }
});

// Dodaj obsługę powiadomień dla różnych zdarzeń
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'fetchData') {
        // ... istniejący kod ...
        
        // Dodaj powiadomienie o nowych zamówieniach
        if (data.newOrders && data.newOrders.length > 0) {
            await NotificationService.notify({
                title: i18n.translate('notifications.newOrders.title'),
                message: i18n.translate('notifications.newOrders.message', {
                    count: data.newOrders.length
                }),
                type: 'info',
                data: { orders: data.newOrders }
            });
        }
    }
});

// Obsługa błędów API
async function handleApiError(error, context) {
    console.error(`API Error (${context}):`, error);
    
    await NotificationService.notify({
        title: i18n.translate('notifications.apiError.title'),
        message: i18n.translate('notifications.apiError.message', {
            context,
            error: error.message
        }),
        type: 'error',
        priority: 'high',
        data: { error, context }
    });
}
  