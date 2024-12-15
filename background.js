import { getDarwinaCredentials } from './config/api.js';
import { CacheService } from './services/cache.js';
import { API_CONFIG } from './config/api.js';
import { stores } from './config/stores.js';

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
                // Najpierw sprawdź cache
                const cachedData = await CacheService.get(CACHE_KEY);
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
});

// Funkcja do pobierania danych z API
async function fetchDarwinaData(darwinaConfig, selectedStore) {
    let allOrders = [];
    
    // Definiujemy grupy statusów
    const statusGroups = [
        '1',            // Złożone
        '2',            // Potwierdzone
        '3',            // Przyjęte do realizacji
        '5'             // Gotowe do odbioru
    ];

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
                sendLogToPopup(`✅ Pobrano stronę dla statusu ${statusGroup}`, 'success', {
                    page: currentPage,
                    ordersCount: data.data.length
                });
            }

            currentPage++;
        } while (currentPage <= totalPages);
    }

    // Przetwórz wszystkie zebrane zamówienia
    const statusCounts = processOrders(allOrders);

    return {
        success: true,
        statusCounts,
        totalOrders: allOrders.length,
        store: selectedStore || 'ALL'
    };
}

// Funkcja do przetwarzania zamówień i liczenia statusów
function processOrders(orders) {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    
    sendLogToPopup('🔍 Rozpoczynam analizę zamówień:', 'info', {
        totalOrders: orders.length,
        uniqueStatuses: [...new Set(orders.map(o => o.status_id))].sort(),
        firstOrder: orders[0] // Zobaczmy pełne dane pierwszego zamówienia
    });

    const statusCounts = orders.reduce((acc, order) => {
        const status = order.status_id;
        // Używamy pola date z API
        const orderDate = order.date ? new Date(order.date.replace(' ', 'T')) : null;

        if (!orderDate) {
            sendLogToPopup('⚠️ Brak daty w zamówieniu:', 'warning', {
                orderId: order.order_id,
                date: order.date
            });
            return acc;
        }

        if (status) {
            const parsedStatus = parseInt(status);
            sendLogToPopup('📊 Przetwarzam zamówienie:', 'info', {
                orderId: order.order_id,
                orderNumber: order.order_number,
                status: status,
                statusName: order.status_name,
                date: order.date,
                parsedDate: orderDate.toISOString(),
                isOlderThanTwoWeeks: orderDate < twoWeeksAgo
            });

            switch (parsedStatus) {
                case API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED:
                    acc['1'] = (acc['1'] || 0) + 1;
                    break;
                case API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED:
                    acc['2'] = (acc['2'] || 0) + 1;
                    break;
                case API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED_STORE:
                    acc['3'] = (acc['3'] || 0) + 1;
                    break;
                case API_CONFIG.DARWINA.STATUS_CODES.READY:
                    if (orderDate < twoWeeksAgo) {
                        acc['OVERDUE'] = (acc['OVERDUE'] || 0) + 1;
                    } else {
                        acc['READY'] = (acc['READY'] || 0) + 1;
                    }
                    break;
                default:
                    sendLogToPopup('⚠️ Nieznany status', 'warning', { 
                        status: status,
                        statusName: order.status_name 
                    });
            }
        }
        return acc;
    }, {});

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
  