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