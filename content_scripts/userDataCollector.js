let dataCollected = false;

// Główna funkcja
async function collectUserData() {
    if (dataCollected) return;

    try {
        const userData = await extractUserData();
        if (userData) {
            chrome.runtime.sendMessage({
                type: 'USER_DATA_COLLECTED',
                payload: userData
            });
            dataCollected = true;
        }
        return userData;
    } catch (error) {
        console.error('Error collecting user data:', error);
        return null;
    }
}

async function extractUserData() {
    try {
        // Pobierz zapisane ID użytkownika z pamięci lokalnej
        const { selectedUserId } = await chrome.storage.local.get('selectedUserId');
        if (!selectedUserId) return null;

        const userData = await enrichUserData(selectedUserId);
        if (!userData) return null;

        return userData;
    } catch (error) {
        console.error('Error extracting user data:', error);
        return null;
    }
}

async function enrichUserData(webLucyMemberId) {
    try {
        const response = await fetch(chrome.runtime.getURL(`users/${webLucyMemberId}.json`));
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Error enriching user data:', error);
        return null;
    }
}

// Uruchom skrypt
collectUserData();
 