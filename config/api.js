export const API_CONFIG = {
    DARWIN: {
        BASE_URL: 'https://api.darwina.pl',
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
                name: 'Przyjęte do realizacji'
            },
            READY: {
                id: 5,
                name: 'Gotowe do odbioru'
            }
        }
    }
}; 