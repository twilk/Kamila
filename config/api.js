import { DELIVERY_IDS } from './delivery.js';
import { stores } from './stores.js';

export const API_CONFIG = {
    DARWINA: {
        BASE_URL: 'https://darwina.pl/api/v1',
        ENDPOINTS: {
            USER: '/user',
            USER_DATA: '/user/data',
            ORDERS: '/orders',
            STATUS: '/status',
            TOKEN: '/auth/access_token'
        },
        STATUS_CODES: {
            SUBMITTED: 1,        // Złożone
            CONFIRMED: 2,        // Potwierdzone przez Klienta
            ACCEPTED_STORE: 3,   // Przyjęte do realizacji w sklepie
            ACCEPTED_SHIPPING: 4, // Przyjęte do realizacji do wysyłki
            READY: 5,           // Gotowe do odbioru w sklepie
            PICKED_UP: 9,       // Towar odebrany w sklepie
            AWAITING_PAYMENT: 13, // Oczekiwanie na płatność - Gotowe do wysyłki
            AWAITING_COURIER: 8,  // Opłacone-Oczekuje na odbiór kuriera
            HANDED_TO_COURIER: 6, // Paczka wydana Pełnomocnikowi
            DELIVERED: 7,        // Paczka dostarczona
            ADDITIONAL_CORR: 12,  // Wysłana dodatkowa korespondencja
            REFUND_REQUESTED: 11, // Rezygnacja-chce zwrot kasy
            CANCELLED: 14,       // Anulowane - nasza porażka
            DO_NOT_USE: 10       // NIE UŻYWAĆ
        }
    }
};

export const API_BASE_URL = 'https://darwina.pl/api/v1';

// Dodaj funkcję wysyłania logów z timestampem
export function sendLogToPopup(message, type = 'info', data = null) {
    const timestamp = new Date().toLocaleTimeString();
    chrome.runtime.sendMessage({
        type: 'LOG_MESSAGE',
        payload: {
            message: `[${timestamp}] ${message}`,
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
        console.log('🔑 Credentials loaded successfully', 'success');
        return credentials;
    } catch (error) {
        console.log('❌ Error loading credentials', 'error', error.message);
        throw error;
    }
}

export const getDarwinaCredentials = async () => {
    try {
        console.log('🔄 Starting credentials fetch...', 'info');
        
        // Load credentials file
        console.log('📄 Loading credentials file...');
        const response = await fetch(chrome.runtime.getURL('config/credentials.json'));
        
        console.log('📄 Credentials response:', 'info', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load credentials: ${response.status} ${response.statusText}`);
        }
        
        const credentials = await response.json();
        
        if (!credentials.client_id || !credentials.client_secret) {
            throw new Error('Invalid credentials format: missing client_id or client_secret');
        }
        
        console.log('🔑 Credentials loaded:', 'info', {
            hasClientId: !!credentials.client_id,
            hasClientSecret: !!credentials.client_secret
        });
        
        const tokenUrl = `${API_BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.TOKEN}`;
        console.log('🔗 Token URL:', 'info', tokenUrl);
        
        // Prepare token request body
        const tokenBody = new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'READWRITE',
            client_id: credentials.client_id,
            client_secret: credentials.client_secret
        });

        console.log('📤 Sending token request...', 'info', {
            url: tokenUrl,
            method: 'POST',
            headers: ['Content-Type'],
            bodyParams: Array.from(tokenBody.keys())
        });
        
        // Request token
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: tokenBody.toString()
        });

        console.log('🔍 Token response status:', 'info', {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            ok: tokenResponse.ok,
            headers: Object.fromEntries(tokenResponse.headers.entries())
        });
        
        if (!tokenResponse.ok) {
            let errorText;
            try {
                errorText = await tokenResponse.text();
            } catch (e) {
                errorText = 'Could not read error response';
            }
            
            console.error('❌ Token response error:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                text: errorText
            });
            
            throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
        }
        
        let tokenData;
        try {
            tokenData = await tokenResponse.json();
        } catch (e) {
            console.error('❌ Token parse error:', e);
            throw new Error('Failed to parse token response');
        }

        if (!tokenData.access_token) {
            throw new Error('Token response missing access_token');
        }

        console.log('🔑 Token received successfully');
        
        const config = {
            DARWINA_API_BASE_URL: API_BASE_URL,
            DARWINA_API_KEY: tokenData.access_token
        };

        console.log('✅ API configuration complete:', {
            hasBaseUrl: !!config.DARWINA_API_BASE_URL,
            hasApiKey: !!config.DARWINA_API_KEY
        });

        return config;
    } catch (error) {
        console.error('❌ Error getting Darwina credentials:', {
            message: error.message,
            stack: error.stack
        });
        return null;
    }
};

export const filterDeliveryResponse = (response) => {
    if (!response || !response.data) return response;

    // Filtruj metody dostawy
    if (response.data.deliveryMethods) {
        response.data.deliveryMethods = response.data.deliveryMethods.filter(method => 
            method.active && 
            Object.values(DELIVERY_IDS).includes(method.id)
        );
    }

    // Filtruj sklepy
    if (response.data.stores) {
        response.data.stores = response.data.stores.filter(store => 
            stores.some(s => s.id === store.id)
        );
    }

    // Filtruj i grupuj zamówienia
    if (response.data.orders) {
        const filteredOrders = response.data.orders.filter(order => 
            order.status !== API_CONFIG.DARWINA.STATUS_CODES.DO_NOT_USE
        );

        response.data.orders = filteredOrders;
        response.data.ordersSummary = generateOrdersSummary(filteredOrders);
    }

    return response;
}; 

// Grupowanie statusów według typu
export const STATUS_GROUPS = {
    STORE_PICKUP: [
        API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED,
        API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED,
        API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED_STORE,
        API_CONFIG.DARWINA.STATUS_CODES.READY,
        API_CONFIG.DARWINA.STATUS_CODES.PICKED_UP
    ],
    SHIPPING: [
        API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED_SHIPPING,
        API_CONFIG.DARWINA.STATUS_CODES.AWAITING_PAYMENT,
        API_CONFIG.DARWINA.STATUS_CODES.AWAITING_COURIER,
        API_CONFIG.DARWINA.STATUS_CODES.HANDED_TO_COURIER,
        API_CONFIG.DARWINA.STATUS_CODES.DELIVERED
    ],
    SPECIAL: [
        API_CONFIG.DARWINA.STATUS_CODES.ADDITIONAL_CORR,
        API_CONFIG.DARWINA.STATUS_CODES.REFUND_REQUESTED,
        API_CONFIG.DARWINA.STATUS_CODES.CANCELLED
    ]
};

// Funkcja do filtrowania zamówień według statusu i typu dostawy
export const filterOrders = (orders, deliveryMethod) => {
    if (!orders) return [];

    const isPickup = deliveryMethod === DELIVERY_METHODS.PICKUP;
    const relevantStatuses = isPickup ? STATUS_GROUPS.STORE_PICKUP : STATUS_GROUPS.SHIPPING;

    return orders.filter(order => {
        // Filtruj według statusu
        const hasValidStatus = relevantStatuses.includes(order.status);
        
        // Filtruj według metody dostawy
        const hasValidDelivery = isPickup ? 
            order.delivery_method === DELIVERY_METHODS.PICKUP :
            order.delivery_method !== DELIVERY_METHODS.PICKUP;

        return hasValidStatus && hasValidDelivery;
    });
};

// Funkcja do grupowania zamówień według statusu
export const groupOrdersByStatus = (orders) => {
    return orders.reduce((acc, order) => {
        const status = order.status;
        if (!acc[status]) {
            acc[status] = [];
        }
        acc[status].push(order);
        return acc;
    }, {});
};

// Funkcja do generowania podsumowania zamówień
export const generateOrdersSummary = (orders) => {
    const grouped = groupOrdersByStatus(orders);
    const summary = {
        total: orders.length,
        byStatus: Object.entries(grouped).map(([status, orders]) => ({
            status: Number(status),
            count: orders.length,
            statusName: getStatusName(status)
        }))
    };

    return summary;
};

// Funkcja pomocnicza do uzyskania nazwy statusu
export const getStatusName = (statusCode) => {
    const statusMap = {
        [API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED]: 'Złożone',
        [API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED]: 'Potwierdzone przez Klienta',
        [API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED_STORE]: 'Przyjęte do realizacji w sklepie',
        [API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED_SHIPPING]: 'Przyjęte do realizacji do wysyłki',
        [API_CONFIG.DARWINA.STATUS_CODES.READY]: 'Gotowe do odbioru w sklepie',
        [API_CONFIG.DARWINA.STATUS_CODES.PICKED_UP]: 'Towar odebrany w sklepie',
        [API_CONFIG.DARWINA.STATUS_CODES.AWAITING_PAYMENT]: 'Oczekiwanie na płatność',
        [API_CONFIG.DARWINA.STATUS_CODES.AWAITING_COURIER]: 'Opłacone-Oczekuje na kuriera',
        [API_CONFIG.DARWINA.STATUS_CODES.HANDED_TO_COURIER]: 'Wydane kurierowi',
        [API_CONFIG.DARWINA.STATUS_CODES.DELIVERED]: 'Dostarczone',
        [API_CONFIG.DARWINA.STATUS_CODES.ADDITIONAL_CORR]: 'Dodatkowa korespondencja',
        [API_CONFIG.DARWINA.STATUS_CODES.REFUND_REQUESTED]: 'Rezygnacja-zwrot',
        [API_CONFIG.DARWINA.STATUS_CODES.CANCELLED]: 'Anulowane',
        [API_CONFIG.DARWINA.STATUS_CODES.DO_NOT_USE]: 'Nieaktywne'
    };

    return statusMap[statusCode] || 'Nieznany status';
}; 