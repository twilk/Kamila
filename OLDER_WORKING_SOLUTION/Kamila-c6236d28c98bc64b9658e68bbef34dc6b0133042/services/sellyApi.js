import { API_CONFIG } from '../config/api.js';
import { ApiError, HTTP_ERRORS } from './errors';
import { RetryStrategy } from './retry';
import { ApiCache } from './cache';
import { DataValidator } from './validator';

class SellyApiService {
    constructor() {
        this.baseUrl = API_CONFIG.SELLY.BASE_URL;
        this.version = API_CONFIG.SELLY.VERSION;
        this.endpoints = API_CONFIG.SELLY.ENDPOINTS;
        this.credentials = null;
        this.retry = new RetryStrategy();
        this.cache = new ApiCache();
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

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}/${this.version}${endpoint}`;
        const cacheKey = `${url}-${JSON.stringify(options)}`;

        // Sprawdź cache
        const cachedData = this.cache.get(cacheKey);
        if (cachedData) return cachedData;

        try {
            const response = await this.retry.execute(async () => {
                const res = await fetch(url, {
                    ...options,
                    headers: {
                        ...this.getHeaders(),
                        ...(options.headers || {})
                    }
                });

                if (!res.ok) {
                    const error = new ApiError(
                        HTTP_ERRORS[res.status] || 'Unknown error',
                        res.status,
                        res.statusText
                    );
                    throw error;
                }

                return res;
            });

            const data = await response.json();
            DataValidator.validateResponse(data);

            // Cache wyników
            this.cache.set(cacheKey, data);
            return data;

        } catch (error) {
            console.error(`API Error: ${error.message}`, {
                endpoint,
                status: error.status,
                code: error.code
            });
            throw error;
        }
    }

    async fetchLeadCounts() {
        try {
            const counts = { submitted: 0, confirmed: 0, accepted: 0, ready: 0, overdue: 0 };
            const statuses = Object.values(API_CONFIG.SELLY.STATUS_CODES);

            await Promise.all(statuses.map(async (status) => {
                if (status === 'overdue') return;

                const data = await this.makeRequest(
                    `${this.endpoints.ORDERS}?status_id=${status}`
                );

                if (status === API_CONFIG.SELLY.STATUS_CODES.READY) {
                    const orders = data.orders || [];
                    counts.ready = orders.filter(order => !this.isOverdue(order)).length;
                    counts.overdue = orders.filter(order => this.isOverdue(order)).length;
                } else {
                    counts[this.getStatusKey(status)] = data.total || 0;
                }
            }));

            return counts;
        } catch (error) {
            console.error('Error fetching lead counts:', error);
            throw error;
        }
    }

    getStatusKey(status) {
        const statusMap = {
            [API_CONFIG.SELLY.STATUS_CODES.SUBMITTED]: 'submitted',
            [API_CONFIG.SELLY.STATUS_CODES.CONFIRMED]: 'confirmed',
            [API_CONFIG.SELLY.STATUS_CODES.ACCEPTED]: 'accepted',
            [API_CONFIG.SELLY.STATUS_CODES.READY]: 'ready'
        };
        return statusMap[status];
    }

    async getLeadDetails(status) {
        try {
            const response = await fetch(`${this.baseUrl}/${this.version}${this.endpoints.ORDERS}?status_id=${status}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Błąd pobierania szczegółów zamówień');
            const data = await response.json();
            return data.orders || [];
        } catch (error) {
            console.error('Błąd API:', error);
            throw error;
        }
    }

    // Pomocnicza funkcja do sprawdzania czy zamówienie jest przeterminowane
    isOverdue(order) {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const orderDate = new Date(order.ready_date || order.modified);
        return orderDate < twoWeeksAgo;
    }
}

export const sellyApi = new SellyApiService(); 