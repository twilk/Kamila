import { UpdateManager } from './services/updateManager.js';

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