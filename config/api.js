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

export const API_BASE_URL = 'https://api.example.com';
export const API_KEY = 'YOUR_API_KEY'; 

import credentials from './credentials.json';

export const SELLY_API_BASE_URL = 'https://darwina.pl/api';
export const SELLY_API_KEY = credentials.apiKey;
export const SELLY_API_SECRET = credentials.apiSecret; 