import { getDarwinaCredentials } from './config/api.js';
import { CacheService } from './services/cache.js';
import { API_CONFIG } from './config/api.js';
import { stores } from './config/stores.js';
import { UserCardService } from './services/userCard.js';
import { APIService } from './services/api.js';

const FETCH_INTERVAL = 5; // minutes
const CACHE_KEY = 'darwina_orders_data';

// 2. Funkcje pomocnicze
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

// 3. Funkcje obsługi danych
async function fetchAndCacheData(selectedStore) {
    try {
        sendLogToPopup('🔄 Rozpoczynam pobieranie danych', 'info');
        const darwinaConfig = await getDarwinaCredentials();
        if (!darwinaConfig?.DARWINA_API_KEY) {
            throw new Error('Brak konfiguracji API');
        }
        
        const data = await fetchDarwinaData(selectedStore);
        if (data.success) {
            await CacheService.set(getCacheKey(selectedStore), data);
            sendLogToPopup('✅ Dane zapisane w cache', 'success');
        }
        return data;
    } catch (error) {
        sendLogToPopup('❌ Błąd pobierania danych', 'error', error.message);
        return { success: false, error: error.message };
    }
}

async function fetchDarwinaData(selectedStore) {
    try {
        const api = new APIService();
        return await api.getOrderStatuses(selectedStore);
    } catch (error) {
        sendLogToPopup('❌ Error', 'error', error.message);
        return { success: false, error: error.message };
    }
}

// 4. Funkcje obsługi użytkownika
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

// 5. Event listenery i inicjalizacja
chrome.runtime.onInstalled.addListener(() => {
    createFetchAlarm();
});

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
});

chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('qr-import-')) {
        // Otwórz popup po kliknięciu w powiadomienie
        chrome.action.openPopup();
    }
});

// Dodaj brakującą funkcję createFetchAlarm
function createFetchAlarm() {
    chrome.alarms.create('fetchData', {
        periodInMinutes: FETCH_INTERVAL
    });
}
  