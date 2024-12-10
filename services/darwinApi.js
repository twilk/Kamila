import { API_CONFIG } from '../config/api.js';

class DarwinApiService {
    constructor() {
        this.baseUrl = API_CONFIG.DARWIN.BASE_URL;
        this.endpoints = API_CONFIG.DARWIN.ENDPOINTS;
        this.credentials = null;
    }

    async initialize() {
        try {
            const response = await fetch('credentials.json');
            this.credentials = await response.json();
        } catch (error) {
            console.error('Błąd podczas ładowania credentials:', error);
            throw new Error('Nie można załadować danych uwierzytelniających');
        }
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.credentials.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async fetchLeadCounts() {
        try {
            const counts = {
                submitted: 0,
                confirmed: 0,
                accepted: 0,
                ready: 0
            };

            // Pobierz wszystkie zamówienia ze statusami
            const response = await fetch(`${this.baseUrl}${this.endpoints.ORDER_STATUS}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Błąd pobierania statusów zamówień');
            
            const data = await response.json();
            
            // Zlicz zamówienia według statusów
            data.forEach(order => {
                switch(order.status_id) {
                    case API_CONFIG.DARWIN.STATUS_CODES.SUBMITTED.id:
                        counts.submitted++;
                        break;
                    case API_CONFIG.DARWIN.STATUS_CODES.CONFIRMED.id:
                        counts.confirmed++;
                        break;
                    case API_CONFIG.DARWIN.STATUS_CODES.ACCEPTED.id:
                        counts.accepted++;
                        break;
                    case API_CONFIG.DARWIN.STATUS_CODES.READY.id:
                        counts.ready++;
                        break;
                }
            });

            return counts;
        } catch (error) {
            console.error('Błąd API:', error);
            throw error;
        }
    }

    async getLeadDetails(statusId) {
        try {
            const response = await fetch(`${this.baseUrl}${this.endpoints.ORDERS}?status_id=${statusId}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Błąd pobierania szczegółów zamówień');
            
            const data = await response.json();
            return this.transformOrdersData(data);
        } catch (error) {
            console.error('Błąd API:', error);
            throw error;
        }
    }

    transformOrdersData(orders) {
        return orders.map(order => ({
            id: order.id,
            status: this.getStatusName(order.status_id),
            customer: {
                name: order.customer_name,
                email: order.customer_email
            },
            items: order.items.map(item => ({
                name: item.product_name,
                quantity: item.quantity,
                price: item.price
            })),
            total: order.total_amount,
            created_at: order.created_at,
            modified_at: order.modified_at
        }));
    }

    getStatusName(statusId) {
        const status = Object.values(API_CONFIG.DARWIN.STATUS_CODES)
            .find(s => s.id === statusId);
        return status ? status.name : 'Nieznany';
    }

    // Metoda do pobierania produktów
    async getProducts() {
        try {
            const response = await fetch(`${this.baseUrl}${this.endpoints.PRODUCTS}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Błąd pobierania produktów');
            return await response.json();
        } catch (error) {
            console.error('Błąd API:', error);
            throw error;
        }
    }

    // Metoda do pobierania klientów
    async getCustomers() {
        try {
            const response = await fetch(`${this.baseUrl}${this.endpoints.CUSTOMERS}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Błąd pobierania klientów');
            return await response.json();
        } catch (error) {
            console.error('Błąd API:', error);
            throw error;
        }
    }
}

export const darwinApi = new DarwinApiService(); 