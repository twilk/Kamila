// Dodaj flagę do śledzenia czy dane zostały już zebrane
let dataCollected = false;

// Funkcja do sprawdzania czy użytkownik jest zalogowany
function isUserLoggedIn() {
    const nameElement = document.querySelector("#heading-widget-1721925309940 > div > h4");
    return !!nameElement;
}

// Funkcja sprawdzająca czy dane sklepu są załadowane
function isShopDataLoaded() {
    const loadingMessage = document.querySelector('p[style*="animation: textColorChange"]');
    return !loadingMessage;
}

// Funkcja sprawdzająca czy QR kod jest dostępny i prawidłowy
function isQRCodeValid() {
    const qrElement = document.querySelector("#darwinaSklep > img");
    return qrElement && qrElement.complete && qrElement.src && !qrElement.src.includes('undefined');
}

// Funkcja sprawdzająca czy dane sesji są dostępne
function isSessionAvailable() {
    return window.sessionDetails && window.sessionDetails.member && window.sessionDetails.member.id;
}

// Funkcja do zbierania danych użytkownika
async function collectUserData() {
    if (dataCollected) {
        console.log('Data already collected, skipping...');
        return null;
    }

    try {
        // Czekaj na załadowanie danych sklepu i sesji
        let attempts = 0;
        const maxAttempts = 60;
        
        while ((!isShopDataLoaded() || !isSessionAvailable()) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            console.log('Waiting for data...', {
                shopDataLoaded: isShopDataLoaded(),
                sessionAvailable: isSessionAvailable(),
                attempts
            });
        }

        if (!isShopDataLoaded()) {
            console.log('Shop data loading timeout');
            return null;
        }

        if (!isSessionAvailable()) {
            console.log('Session data not available');
            return null;
        }

        // Pobierz dane użytkownika
        const memberId = window.sessionDetails.member.id;
        const nameElement = document.querySelector("#heading-widget-1721925309940 > div > h4");
        const fullName = nameElement?.textContent || '';
        const firstName = fullName.split(' ')[0];

        // Sprawdź czy mamy wszystkie podstawowe dane
        if (!memberId || !fullName) {
            console.log('Missing required user data', { memberId, fullName });
            return null;
        }

        // Pobierz QR kod
        const qrElement = document.querySelector("#darwinaSklep > img");
        const qrCodeUrl = qrElement?.src || '';

        // Sprawdź czy QR kod jest prawidłowy
        if (!isQRCodeValid()) {
            console.log('Invalid or missing QR code');
            return null;
        }

        console.log('Successfully collected user data', { memberId, firstName, fullName });
        return {
            memberId,
            firstName,
            fullName,
            qrCodeUrl,
            lastLogin: new Date().toISOString(),
            notificationShown: false
        };
    } catch (error) {
        console.error('Error collecting user data:', error);
        return null;
    }
}

// Funkcja do wysyłania danych do extension
function sendDataToExtension(data) {
    chrome.runtime.sendMessage({
        type: 'USER_DATA_COLLECTED',
        payload: data
    });
}

// Główna funkcja inicjalizująca
async function initialize() {
    if (!isUserLoggedIn()) {
        console.log('User not logged in, waiting...');
        const checkInterval = setInterval(async () => {
            if (isUserLoggedIn() && !dataCollected) {
                clearInterval(checkInterval);
                const userData = await collectUserData();
                if (userData) {
                    sendDataToExtension(userData);
                }
            }
        }, 1000);
        return;
    }

    if (!dataCollected) {
        const userData = await collectUserData();
        if (userData) {
            sendDataToExtension(userData);
        }
    }
}

// Uruchom inicjalizację gdy DOM jest gotowy
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Nasłuchuj na zmiany w DOM
const observer = new MutationObserver(async (mutations) => {
    if (dataCollected) return; // Przerwij jeśli dane już zebrane

    for (const mutation of mutations) {
        if (mutation.type === 'childList' && isUserLoggedIn()) {
            const userData = await collectUserData();
            if (userData) {
                sendDataToExtension(userData);
            }
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
}); 