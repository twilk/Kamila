import { UpdateManager } from './services/updateManager.js';
import { getSellyCredentials } from './config/api.js';

const updateManager = new UpdateManager();
const CHECK_INTERVAL = 1000 * 60 * 60; // co godzinę

// Nasłuchuj na instalację
chrome.runtime.onInstalled.addListener(() => {
    checkForUpdates();
    createAlarm();
});

// Utwórz alarm do okresowego sprawdzania
function createAlarm() {
    chrome.alarms.create('checkUpdate', {
        periodInMinutes: 60 // co godzinę
    });
}

// Nasłuchuj na alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkUpdate') {
        checkForUpdates();
    }
});

async function checkForUpdates() {
    try {
        const updateInfo = await updateManager.checkForUpdates();
        if (updateInfo.hasUpdate) {
            await chrome.storage.local.set({ pendingUpdate: updateInfo });
            
            await chrome.action.setBadgeText({ 
                text: 'UPD' 
            });
            await chrome.action.setBadgeBackgroundColor({ 
                color: '#4CAF50' 
            });
        }
    } catch (error) {
        console.error('Błąd sprawdzania aktualizacji:', error);
    }
}

// Nasłuchuj na wiadomości
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_UPDATES') {
        checkForUpdates()
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Informuje Chrome, że odpowiedź będzie asynchroniczna
    }
});

// Mapowanie MIME types na rozszerzenia
const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff'
};

// Obsługa zapisywania tapet
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SAVE_WALLPAPER') {
        const file = message.data.get('wallpaper');
        const reader = new FileReader();

        reader.onload = async () => {
            try {
                const response = await fetch(reader.result);
                const blob = await response.blob();
                
                // Użyj mapowania MIME type na rozszerzenie
                const ext = mimeToExt[message.mimeType] || 'jpg';
                const path = `wallpapers/custom/bg.${ext}`;

                // Zapisz plik
                await chrome.storage.local.set({
                    customWallpaper: {
                        url: reader.result,
                        path: path,
                        mimeType: message.mimeType
                    }
                });

                sendResponse({ 
                    success: true, 
                    url: reader.result 
                });
            } catch (error) {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            }
        };

        reader.onerror = () => {
            sendResponse({ 
                success: false, 
                error: 'Błąd odczytu pliku' 
            });
        };

        reader.readAsDataURL(file);
        return true;
    }
});

// Dodaj funkcję wysyłania logów do popup
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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'FETCH_SELLY_DATA') {
        try {
            const sellyConfig = await getSellyCredentials();
            sendLogToPopup('📡 Fetching data from Selly API...', 'info');
            
            // Parametry zapytania
            const params = new URLSearchParams({
                status_id: '9,7',
                limit: '50',
                date_to: '2024-12-01',
                date_from: message.dateFrom || '2024-01-01',
                page: message.page || '1'
            });

            sendLogToPopup('🔍 Request params:', 'info', params.toString());

            const response = await fetch(
                `${sellyConfig.SELLY_API_BASE_URL}/orders?${params.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${sellyConfig.SELLY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Dodaj szczegółowe informacje o odpowiedzi
            const responseDetails = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                url: response.url
            };

            if (!response.ok) {
                throw new Error(`Błąd API: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            sendLogToPopup('📦 Received data:', 'info', `${data.length} orders`);

            // Przygotuj dane zgodnie z dokumentacją API
            const orders = Array.isArray(data) ? data : (data.data || []);
            const statusCounts = orders.reduce((acc, order) => {
                const status = order.status_id;
                if (status) {
                    acc[status] = (acc[status] || 0) + 1;
                }
                return acc;
            }, {});

            sendLogToPopup('📊 Status counts:', 'info', JSON.stringify(statusCounts));

            sendResponse({ 
                success: true, 
                statusCounts: statusCounts,
                responseDetails: responseDetails
            });
        } catch (error) {
            sendLogToPopup('❌ API Error:', 'error', error.message);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
}); 