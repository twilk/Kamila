import { API_BASE_URL, API_CONFIG, getDarwinaCredentials, sendLogToPopup } from '../config/api.js';

export async function checkStatus() {
    try {
        const darwinaConfig = await getDarwinaCredentials();
        const response = await fetch(`${darwinaConfig.DARWINA_API_BASE_URL}/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Status check failed:', error);
        return { status: 'error', message: error.message };
    }
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
            
            const cacheKey = `darwina_orders_data_${selectedStore}`;
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
            // Używamy jednej wspólnej funkcji do przetwarzania statusów
            const statusCounts = this.processOrderStatuses(allOrders, selectedStore);
            
            const result = { success: true, statusCounts };
            await CacheService.set(cacheKey, result);
            sendLogToPopup('✅ Dane zapisane w cache', 'success');
            return result;

        } catch (error) {
            sendLogToPopup('❌ API Error', 'error', error.message);
            return { success: false, error: error.message };
        }
    }

    processOrderStatuses(orders, selectedStore) {
        return orders.reduce((acc, order) => {
            if (selectedStore === 'ALL' || order.delivery_name?.startsWith(selectedStore)) {
                if (order.status_id === '5') {
                    const twoWeeksAgo = new Date();
                    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                    const orderDate = new Date(order.ready_date || order.status_change_date);
                    
                    if (orderDate >= twoWeeksAgo) {
                        acc['READY'] = (acc['READY'] || 0) + 1;
                    } else {
                        acc['OVERDUE'] = (acc['OVERDUE'] || 0) + 1;
                    }
                } else {
                    const statusId = order.status_id.toString();
                    acc[statusId] = (acc[statusId] || 0) + 1;
                }
            }
            return acc;
        }, {});
    }
}

export const API = new APIService(); 

// Funkcje sprawdzające status
export async function checkApiStatus() {
    try {
        const darwinaConfig = await getDarwinaCredentials();
        const response = await fetch(`${darwinaConfig.DARWINA_API_BASE_URL}/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        return response.ok;
    } catch (error) {
        console.error('API status check failed:', error);
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
        const darwinaConfig = await getDarwinaCredentials();
        const response = await fetch(`${darwinaConfig.DARWINA_API_BASE_URL}/orders?limit=1`, {
            headers: {
                'Authorization': `Bearer ${darwinaConfig.DARWINA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Orders status check failed:', error);
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