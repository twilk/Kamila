export const API_CONFIG = {
    DARWIN: {
        BASE_URL: 'https://darwina.pl/api',
        ENDPOINTS: {
            ORDERS: '/orders',
            ORDER_STATUS: '/orders/status',
            ORDER_DETAILS: '/orders/{id}',
            PRODUCTS: '/products',
            CUSTOMERS: '/customers'
        },
        STATUS_CODES: {
            SUBMITTED: {
                id: 1,
                name: 'Złożone'
            },
            CONFIRMED: {
                id: 2,
                name: 'Potwierdzone przez Klienta'
            },
            ACCEPTED: {
                id: 3,
                name: 'Przyjęte do realizacji w sklepie'
            },
            READY: {
                id: 5,
                name: 'Gotowe do odbioru w sklepie'
            }
        }
    }
};

export const API_BASE_URL = 'https://darwina.pl/api';
export const API_KEY = 'YOUR_API_KEY'; 

// Dodaj funkcję wysyłania logów
export function sendLogToPopup(message, type = 'info', data = null) {
    chrome.runtime.sendMessage({
        type: 'LOG_MESSAGE',
        payload: {
            message,
            type,
            data
        }
    });
}

export async function loadCredentials() {
    try {
        const response = await fetch('./config/credentials.json');
        if (!response.ok) {
            throw new Error(`Failed to load credentials: ${response.status} ${response.statusText}`);
        }
        const credentials = await response.json();
        sendLogToPopup('🔑 Credentials loaded successfully', 'success');
        return credentials;
    } catch (error) {
        sendLogToPopup('❌ Error loading credentials', 'error', error.message);
        throw error;
    }
}

export const getSellyCredentials = async () => {
    try {
        const credentials = await loadCredentials();
        sendLogToPopup('🔐 API Key loaded', 'info', `${credentials.apiKey.substring(0, 10)}...`);
        return {
            SELLY_API_BASE_URL: 'https://darwina.pl/api',
            SELLY_API_KEY: credentials?.apiKey
        };
    } catch (error) {
        sendLogToPopup('⚠️ Using fallback API configuration', 'warning');
        return {
            SELLY_API_BASE_URL: 'https://darwina.pl/api',
            SELLY_API_KEY: 'your_api_key_here'
        };
    }
}; 