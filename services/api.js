/**
 * @deprecated This file is being migrated to TypeScript implementation in services/api/index.ts
 * Please refer to the migration guide in docs/api-migration.md
 * This file will be removed in version 4.0.0
 */

import { API_BASE_URL, API_CONFIG, getDarwinaCredentials, sendLogToPopup } from '../config/api.js';
import { CacheService } from './cache.js';

// Helper function to check if popup is open and log accordingly
const log = (message, type, data) => {
    chrome.runtime.getContexts({ contextTypes: ['POPUP'] }, (contexts) => {
        if (contexts.length > 0) {
            sendLogToPopup(message, type, data);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`, data || '');
        }
    });
};

export async function checkStatus() {
    const darwinaConfig = await getDarwinaCredentials();
    const response = await fetch(`${darwinaConfig.DARWINA_API_BASE_URL}/status`, {
        headers: {
            'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to check status');
    }
    return await response.json();
}

export class APIService {
    constructor() {
        this.baseUrl = API_CONFIG.DARWINA.BASE_URL;
        this.apiKey = null;
    }

    async init() {
        if (this.apiKey) return;

        const credentials = await getDarwinaCredentials();
        if (!credentials?.DARWINA_API_KEY) {
            throw new Error('No API key available');
        }
        this.apiKey = credentials.DARWINA_API_KEY;
        sendLogToPopup('✅ API initialized', 'success');
    }

    async getOrderStatuses(selectedStore = 'ALL') {
        try {
            await this.init();

            const now = new Date();
            const yesterday = new Date(now - 24 * 60 * 60 * 1000);
            
            const cacheKey = `orders_${selectedStore}`;
            const cachedData = await CacheService.get(cacheKey);
            if (cachedData) {
                sendLogToPopup('📦 Użyto danych z cache', 'info');
                return cachedData;
            }

            sendLogToPopup('🔄 Pobieranie danych z API...', 'info');
            const params = new URLSearchParams({
                status_id: [
                    API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED,
                    API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED,
                    API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED,
                    API_CONFIG.DARWINA.STATUS_CODES.READY
                ].join(','),
                date_from: yesterday.toISOString().split('T')[0],
                date_to: now.toISOString().split('T')[0],
                page: '1'
            });

            const response = await fetch(`${this.baseUrl}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const totalPages = data.__metadata?.page_count || 1;
            sendLogToPopup(`📄 Pobrano stronę 1/${totalPages}`, 'info');
            let allOrders = [...data.data];

            // Pobierz pozostałe strony
            for (let page = 2; page <= totalPages; page++) {
                params.set('page', page.toString());
                sendLogToPopup(`📄 Pobieranie strony ${page}/${totalPages}...`, 'info');
                const nextResponse = await fetch(`${this.baseUrl}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!nextResponse.ok) {
                    sendLogToPopup(`❌ Błąd pobierania strony ${page}`, 'error');
                    continue;
                }
                
                const nextData = await nextResponse.json();
                allOrders = [...allOrders, ...nextData.data];
                sendLogToPopup(`✅ Pobrano stronę ${page}/${totalPages}`, 'success');
            }

            sendLogToPopup(`📊 Łącznie pobrano ${allOrders.length} zamówień`, 'info');
            // Zlicz statusy
            const statusCounts = allOrders.reduce((acc, order) => {
                if (selectedStore === 'ALL' || order.delivery_name?.startsWith(selectedStore)) {
                    const statusId = order.status_id.toString();
                    acc[statusId] = (acc[statusId] || 0) + 1;
                }
                return acc;
            }, {});

            const result = { success: true, statusCounts };
            await CacheService.set(cacheKey, result);
            sendLogToPopup('✅ Dane zapisane w cache', 'success');
            return result;

        } catch (error) {
            sendLogToPopup('❌ API Error', 'error', error.message);
            return { success: false, error: error.message };
        }
    }
}

export const API = new APIService(); 

// Funkcje sprawdzające status
export async function checkApiStatus() {
    try {
        // const response = await fetch(`${API_BASE_URL}/health`);
        // return response.ok;
        return true; // Tymczasowo zawsze zwracaj true
    } catch {
        return false;
    }
}

export async function checkAuthStatus() {
    try {
        const credentials = await getDarwinaCredentials();
        return !!credentials?.DARWINA_API_KEY;
    } catch {
        return false;
    }
}

export async function checkOrdersStatus() {
    try {
        // const response = await fetch(`${API_BASE_URL}/orders?limit=1`);
        // return response.ok;
        return true; // Tymczasowo zawsze zwracaj true
    } catch {
        return false;
    }
}

export async function checkCacheStatus() {
    try {
        return await CacheService.isAvailable();
    } catch {
        return false;
    }
} 