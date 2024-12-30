import { getDarwinaCredentials } from './config/api.js';
import { CacheService } from './services/cache.js';
import { API_CONFIG } from './config/api.js';
import { stores } from './config/stores.js';
import { UserCardService } from './services/userCard.js';

const FETCH_INTERVAL = 5; // minutes
const CHECK_INTERVAL = 15; // minutes
const CACHE_KEY = 'darwina_orders_data';

// Nasłuchuj na instalację
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[DEBUG] 🔧 Rozpoczynam instalację rozszerzenia...');
    try {
        console.log('[DEBUG] ⚙️ Tworzę alarm do pobierania danych...');
        await createFetchAlarm();
        
        console.log('[DEBUG] ⚙️ Tworzę alarm do sprawdzania zamówień...');
        await createOrderCheckAlarm();
        
        console.log('[DEBUG] 🔄 Uruchamiam pierwsze sprawdzanie zamówień...');
        await checkAndUpdateOrders();
        
        // Inicjalizacja badge'a
        const { selectedStore } = await chrome.storage.local.get('selectedStore');
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
        const lastFetchKey = 'last_fetch_timestamp';
        chrome.storage.local.get(lastFetchKey, async (result) => {
            try {
                const lastFetch = result[lastFetchKey] || 0;
                const now = Date.now();
                
                if (now - lastFetch >= FETCH_INTERVAL * 60 * 1000) {
                    console.log('[DEBUG] 🔄 Rozpoczynam pobieranie danych...');
                    await fetchAndCacheData();
                    await chrome.storage.local.set({ [lastFetchKey]: now });
                    console.log('[SUCCESS] ✅ Dane pobrane i zapisane');
                } else {
                    console.log('[DEBUG] ⏳ Zbyt wcześnie na odświeżanie danych');
                }
            } catch (error) {
                console.error('[ERROR] ❌ Błąd podczas obsługi alarmu fetchData:', error);
            }
        });
    } else if (alarm.name === 'checkOrders') {
        console.log('[DEBUG] 📦 Obsługa alarmu checkOrders...');
        checkAndUpdateOrders().catch(error => {
            console.error('[ERROR] ❌ Błąd podczas sprawdzania zamówień:', error);
        });
    }
});

// Funkcja do pobierania i cachowania danych
async function fetchAndCacheData(selectedStore) {
    try {
        const log = (message, type, data) => {
            chrome.runtime.getContexts({ contextTypes: ['POPUP'] }, (contexts) => {
                if (contexts.length > 0) {
                    sendLogToPopup(message, type, data);
                } else {
                    console.log(`[${type.toUpperCase()}] ${message}`, data || '');
                }
            });
        };

        log('🔄 Rozpoczynam pobieranie danych', 'info');
        const darwinaConfig = await getDarwinaCredentials();
        const data = await fetchDarwinaData(darwinaConfig, selectedStore);
        if (data.success) {
            await CacheService.set(getCacheKey(selectedStore), data);
            log('✅ Dane zapisane w cache', 'success');
            // Aktualizuj badge po pobraniu nowych danych
            updateExtensionBadge(data.counts, selectedStore);
        }
        return data;
    } catch (error) {
        chrome.runtime.getContexts({ contextTypes: ['POPUP'] }, (contexts) => {
            if (contexts.length > 0) {
                sendLogToPopup('❌ Błąd pobierania danych', 'error', error.message);
            } else {
                console.error('❌ Błąd pobierania danych:', error.message);
            }
        });
        throw error;
    }
}

// Nasłuchuj na wiadomości
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Otrzymano wiadomość:', message);
    
    // Wrapper dla asynchronicznych handlerów
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
            const cacheKey = getCacheKey(message.selectedStore);
            const cachedData = await CacheService.get(cacheKey);
            if (cachedData) {
                console.log('📦 Zwracam dane z cache');
                updateExtensionBadge(cachedData.counts, message.selectedStore);
                return cachedData;
            }
            console.log('🔄 Cache pusty, pobieram nowe dane');
            const data = await fetchAndCacheData(message.selectedStore);
            updateExtensionBadge(data.counts, message.selectedStore);
            return data;
        });
        return true;
    }

    if (message.type === 'POPUP_OPENED') {
        handleAsyncMessage(async () => {
            try {
                console.log('[DEBUG] 📱 Popup otwarty - rozpoczynam ładowanie danych');
                
                // Pobierz aktualnie wybrany sklep
                const { selectedStore } = await chrome.storage.local.get('selectedStore');
                console.log('[DEBUG] 🏪 Wybrany sklep:', selectedStore || 'ALL');
                
                // Sprawdź dane w cache
                const cacheKey = getCacheKey(selectedStore);
                const cachedData = await CacheService.get(cacheKey);
                
                if (cachedData?.success) {
                    console.log('[DEBUG] ⚡ Zwracam dane z cache');
                    return cachedData;
                }

                // Jeśli brak danych w cache lub są nieaktualne, pobierz nowe
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
});

// Handler dla FETCH_DARWINA_DATA
async function handleFetchDarwinaData(message, sendResponse) {
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
        console.error('Błąd podczas FETCH_DARWINA_DATA:', error);
        sendResponse({ success: false, error: error.message });
    }
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
        return await new Promise((resolve) => {
            const callback = (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    console.log('Message sending failed (popup might be closed):', lastError);
                    resolve(null);
                } else {
                    resolve(response);
                }
            };
            
            chrome.runtime.sendMessage({ type, payload }, callback);
        });
    } catch (error) {
        console.log('Error sending message:', error);
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
async function handlePopupOpened(sendResponse) {
    try {
        await checkAndUpdateOrders();
        
        const storage = await chrome.storage.local.get(['leadCounts', 'lastUpdate']);
        const now = Date.now();
        const cacheAge = now - (storage.lastUpdate || 0);
        
        if (storage.leadCounts && cacheAge < FETCH_INTERVAL * 60 * 1000) {
            sendResponse({success: true, data: storage.leadCounts});
            return;
        }
        
        const data = await fetchAndCacheData();
        await chrome.storage.local.set({ 
            lastUpdate: now,
            leadCounts: data.counts 
        });
        
        sendResponse({success: true, data: data.counts});
    } catch (error) {
        console.error('Błąd podczas obsługi POPUP_OPENED:', error);
        sendResponse({success: false, error: error.message});
    }
}

// Bezpieczna wersja handleCheckOrdersNow
async function handleCheckOrdersNow(sendResponse) {
    try {
        await checkAndUpdateOrders();
        const data = await fetchAndCacheData();
        await chrome.storage.local.set({ 
            lastUpdate: Date.now(),
            leadCounts: data.counts 
        });
        
        sendResponse({success: true, data: data.counts});
    } catch (error) {
        console.error('Błąd podczas CHECK_ORDERS_NOW:', error);
        sendResponse({success: false, error: error.message});
    }
}

// Funkcja do pobierania danych z API
async function fetchDarwinaData(darwinaConfig, selectedStore) {
    let allOrders = [];
    
    // Definiujemy grupy statusów
    const statusGroups = ['1', '2', '3', '5']; // Używamy stringów dla API

    console.log('[DEBUG] 📋 Pobieranie danych dla statusów:', statusGroups);

    // Dla każdej grupy statusów wykonaj osobne zapytanie
    for (const statusGroup of statusGroups) {
        let currentPage = 1;
        let totalPages = 1;
        
        // Przygotuj parametry dla danej grupy statusów
        const baseParams = new URLSearchParams();
        baseParams.append('status_id', statusGroup);
        baseParams.append('limit', '50');

        // Dodaj filtr sklepu (tylko delivery_id)
        if (selectedStore && selectedStore !== 'ALL') {
            const store = stores.find(s => s.id === selectedStore);
            if (!store) {
                throw new Error(`Nie znaleziono sklepu o ID: ${selectedStore}`);
            }
            baseParams.append('delivery_id', store.deliveryId.toString());
        }

        // Pobierz wszystkie strony dla danego statusu
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
                console.log(`[DEBUG] 📦 Pobrano ${data.data.length} zamówień dla statusu ${statusGroup} (strona ${currentPage}/${totalPages})`);
            }

            currentPage++;
        } while (currentPage <= totalPages);
    }

    // Przetwórz wszystkie zebrane zamówienia
    const statusCounts = processOrders(allOrders);

    const result = {
        success: true,
        counts: statusCounts,
        totalOrders: allOrders.length,
        store: selectedStore || 'ALL'
    };

    console.log('[DEBUG] 🔍 Końcowy wynik:', result);

    return result;
}

// Funkcja do przetwarzania zamówień i liczenia statusów
function processOrders(orders) {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const totalOrders = orders.length;
    let processedCount = 0;
    
    console.log(`[DEBUG] 📊 Rozpoczynam analizę ${totalOrders} zamówień`);

    const statusCounts = orders.reduce((acc, order) => {
        processedCount++;
        if (processedCount % 10 === 0) {
            console.log(`[DEBUG] 🔄 Przetworzono ${processedCount}/${totalOrders} zamówień`);
        }

        const status = order.status_id;
        
        // Dla statusu READY (5) używamy ready_date lub status_change_date
        const orderDate = status === '5' ? 
            (order.ready_date || order.status_change_date) : 
            order.date;
            
        const parsedDate = orderDate ? new Date(orderDate.replace(' ', 'T')) : null;

        if (status === '5' && !parsedDate) {
            console.log(`[WARNING] ⚠️ Brak daty dla zamówienia gotowego do odbioru ${order.id}`);
            return acc;
        }

        // Zliczaj zamówienia tylko na podstawie status_id
        const parsedStatus = parseInt(status);
        switch (parsedStatus) {
            case 1: // SUBMITTED
                acc['1'] = (acc['1'] || 0) + 1;
                console.log(`[DEBUG] 📝 Zamówienie ${order.id} - status: Złożone`);
                break;
            case 2: // CONFIRMED
                acc['2'] = (acc['2'] || 0) + 1;
                console.log(`[DEBUG] ✓ Zamówienie ${order.id} - status: Potwierdzone`);
                break;
            case 3: // ACCEPTED_STORE
                acc['3'] = (acc['3'] || 0) + 1;
                console.log(`[DEBUG] 🏪 Zamówienie ${order.id} - status: Przyjęte`);
                break;
            case 5: // READY
                if (parsedDate < twoWeeksAgo) {
                    acc['OVERDUE'] = (acc['OVERDUE'] || 0) + 1;
                    console.log(`[DEBUG] ⏳ Zamówienie ${order.id} oznaczone jako przeterminowane (data: ${orderDate})`);
                } else {
                    acc['READY'] = (acc['READY'] || 0) + 1;
                    console.log(`[DEBUG] 📦 Zamówienie ${order.id} - status: Gotowe do odbioru`);
                }
                break;
            default:
                console.log(`[WARNING] ⚠️ Nieznany status ${parsedStatus} dla zamówienia ${order.id}`);
        }
        return acc;
    }, {});

    // Przygotuj obiekt wynikowy z wszystkimi licznikami
    const results = {
        '1': statusCounts['1'] || 0,
        '2': statusCounts['2'] || 0,
        '3': statusCounts['3'] || 0,
        'READY': statusCounts['READY'] || 0,
        'OVERDUE': statusCounts['OVERDUE'] || 0
    };

    console.log('[DEBUG] 🔍 Debug statusów:', {
        rawCounts: statusCounts,
        processedCounts: results,
        totalOrders: totalOrders
    });

    console.log(`[DEBUG] 📊 Podsumowanie statusów:`, results);
    console.log(`[DEBUG] ✅ Zakończono analizę wszystkich ${totalOrders} zamówień`);

    return results;
}

function getCacheKey(selectedStore) {
    return `${CACHE_KEY}_${selectedStore || 'ALL'}`;
}

// Funkcja sprawdzająca i aktualizująca zamówienia
async function checkAndUpdateOrders() {
    try {
        const log = (message, type, data) => {
            chrome.runtime.getContexts({ contextTypes: ['POPUP'] }, (contexts) => {
                if (contexts.length > 0) {
                    sendLogToPopup(message, type, data);
                } else {
                    console.log(`[${type.toUpperCase()}] ${message}`, data || '');
                }
            });
        };

        log('🔄 Rozpoczynam sprawdzanie zamówień', 'info');
        const darwinaConfig = await getDarwinaCredentials();
        
        if (!darwinaConfig) {
            log('❌ Brak konfiguracji API', 'error');
            return;
        }

        const apiUrl = `${darwinaConfig.DARWINA_API_BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}`;

        // Pobierz wszystkie zamówienia ze statusem 1 (SUBMITTED)
        const params = new URLSearchParams({
            status_id: '1',
            delivery_id: '3',
            limit: '50'
        });

        log('🔍 Pobieram zamówienia ze statusem SUBMITTED...', 'info');
        const response = await fetch(`${apiUrl}?${params}`, {
            headers: {
                'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const allOrders = data.data || [];
        const totalPages = data.__metadata?.page_count || 1;

        log(`📦 Znaleziono ${allOrders.length} zamówień na stronie 1/${totalPages}`, 'info');

        // Pobierz pozostałe strony
        for (let page = 2; page <= totalPages; page++) {
            params.set('page', page.toString());
            const pageResponse = await fetch(`${apiUrl}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!pageResponse.ok) {
                log(`⚠️ Błąd pobierania strony ${page}`, 'warning');
                continue;
            }

            const pageData = await pageResponse.json();
            if (pageData.data) {
                allOrders.push(...pageData.data);
                log(`📦 Pobrano stronę ${page}/${totalPages} (${pageData.data.length} zamówień)`, 'info');
            }
        }

        log(`🔍 Sprawdzam ${allOrders.length} zamówień...`, 'info');

        // Sprawdź każde zamówienie
        for (const order of allOrders) {
            try {
                log(`🔍 Sprawdzam zamówienie ${order.order_id}`, 'info', {
                    delivery_id: order.delivery_id,
                    status_id: order.status_id,
                    client_comment: order.client_comment
                });
                
                const deliveryId = parseInt(order.delivery_id);
                const statusId = parseInt(order.status_id);

                if (deliveryId !== 3) {
                    log(`ℹ️ Pomijam zamówienie ${order.order_id} - delivery_id (${order.delivery_id}) różne od 3`, 'info');
                    continue;
                }

                if (statusId !== 1) {
                    log(`⚠️ Zamówienie ${order.order_id} ma status=${order.status_id}, nie sprawdzam punktu odbioru`, 'info');
                    continue;
                }

                const clientComment = order.client_comment || '';
                log('📝 Analizuję komentarz klienta', 'info', { clientComment });

                const match = clientComment.match(/PUNKT\s+ODBIORU:\s*(.*?)(?:$|\n)/i);
                if (!match) {
                    log(`⚠️ Brak informacji o punkcie odbioru w zamówieniu ${order.order_id}`, 'warning');
                    continue;
                }

                const selectedStore = match[1].trim();
                log('✨ Wyciągnięto punkt odbioru', 'info', { selectedStore });

                const storeInfo = stores.find(s => {
                    if (!s.address) return false;
                    const normalizedStoreAddress = s.address.toLowerCase().replace(/\s+/g, ' ').trim();
                    const normalizedSelectedStore = selectedStore.toLowerCase().replace(/\s+/g, ' ').trim();
                    return normalizedStoreAddress === normalizedSelectedStore;
                });

                if (!storeInfo) {
                    log(`⚠️ Nie znaleziono sklepu dla adresu: ${selectedStore}`, 'warning');
                    continue;
                }

                log(`🎯 Znaleziono sklep: ${storeInfo.name}`, 'info', storeInfo);
                
                const updateData = {
                    delivery_id: storeInfo.deliveryId.toString()
                };

                log('📤 Wysyłam żądanie aktualizacji', 'info', { 
                    url: `${apiUrl}/${order.order_id}`,
                    updateData
                });

                const updateResponse = await fetch(`${apiUrl}/${order.order_id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updateData)
                });

                if (updateResponse.ok) {
                    const updateData = await updateResponse.json();
                    log(`✅ Zaktualizowano zamówienie ${order.order_id}`, 'success', updateData);
                } else {
                    const errorText = await updateResponse.text();
                    throw new Error(`Błąd aktualizacji: ${updateResponse.status} - ${errorText}`);
                }
            } catch (orderError) {
                log(`❌ Błąd przetwarzania zamówienia ${order.order_id}`, 'error', orderError.message);
            }
        }

        log('✅ Zakończono sprawdzanie zamówień', 'success');
    } catch (error) {
        chrome.runtime.getContexts({ contextTypes: ['POPUP'] }, (contexts) => {
            if (contexts.length > 0) {
                sendLogToPopup('❌ Błąd sprawdzania zamówień', 'error', error.message);
            } else {
                console.error('❌ Błąd sprawdzania zamówień:', error.message);
            }
        });
    }
}

// Nasłuchuj na uruchomienie rozszerzenia
chrome.runtime.onStartup.addListener(async () => {
    console.log('[DEBUG] 🚀 Rozpoczynam uruchamianie rozszerzenia...');
    try {
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
function updateExtensionBadge(counts, selectedStore) {
    // Jeśli nie ma danych o licznikach, ukryj badge
    if (!counts) {
        chrome.action.setBadgeText({ text: '' });
        return;
    }
    
    // Oblicz sumę zamówień ze statusem 1 i 2
    const sum = (parseInt(counts['1']) || 0) + (parseInt(counts['2']) || 0);
    
    // Jeśli suma wynosi 0 lub nie wybrano konkretnego sklepu (ALL), ukryj badge
    if (sum === 0 || !selectedStore || selectedStore === 'ALL') {
        chrome.action.setBadgeText({ text: '' });
        return;
    }
    
    // Ustaw badge z sumą zamówień
    chrome.action.setBadgeText({ text: sum.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    console.log(`[DEBUG] 🔄 Zaktualizowano badge dla sklepu ${selectedStore}: ${sum}`);
}
  