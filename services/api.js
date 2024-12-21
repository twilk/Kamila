import { API_BASE_URL, API_CONFIG, getDarwinaCredentials, sendLogToPopup } from '../config/api.js';
import { NotificationService } from './notification.service.js';

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
                sendLogToPopup('�� Użyto danych z cache', 'info');
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

    static async fetchOrders(selectedStore) {
        try {
            const response = await this.request('/orders', {
                params: { store: selectedStore }
            });

            // Sprawdź nowe zamówienia
            const newOrders = this.checkForNewOrders(response.data);
            if (newOrders.length > 0) {
                await NotificationService.notify({
                    title: i18n.translate('notifications.newOrders.title'),
                    message: i18n.translate('notifications.newOrders.message', {
                        count: newOrders.length
                    }),
                    type: 'info',
                    data: { orders: newOrders }
                });
            }

            return response;
        } catch (error) {
            await NotificationService.notify({
                title: i18n.translate('notifications.apiError.title'),
                message: i18n.translate('notifications.apiError.message', {
                    context: 'pobierania zamówień',
                    error: error.message
                }),
                type: 'error'
            });
            throw error;
        }
    }

    static async checkForNewOrders(orders) {
        try {
            const lastCheck = await chrome.storage.local.get('lastOrderCheck');
            const lastCheckTime = lastCheck.lastOrderCheck || 0;
            const newOrders = orders.filter(order => {
                const orderTime = new Date(order.created_at).getTime();
                return orderTime > lastCheckTime;
            });

            await chrome.storage.local.set({ 
                lastOrderCheck: Date.now(),
                lastOrderIds: orders.map(o => o.id)
            });

            return newOrders;
        } catch (error) {
            console.error('Error checking for new orders:', error);
            return [];
        }
    }

    static async handleStatusChange(orderId, newStatus) {
        try {
            const response = await this.request(`/orders/${orderId}/status`, {
                method: 'PUT',
                data: { status: newStatus }
            });

            await NotificationService.notify({
                title: i18n.translate('notifications.statusUpdate.title'),
                message: i18n.translate('notifications.statusUpdate.message', {
                    orderId,
                    status: this.getStatusName(newStatus)
                }),
                type: 'success'
            });

            return response;
        } catch (error) {
            await NotificationService.notify({
                title: i18n.translate('notifications.apiError.title'),
                message: i18n.translate('notifications.apiError.message', {
                    context: 'zmiany statusu',
                    error: error.message
                }),
                type: 'error'
            });
            throw error;
        }
    }

    static getStatusName(statusId) {
        const statusMap = {
            1: 'Złożone',
            2: 'Potwierdzone',
            3: 'Przyjęte do realizacji',
            5: 'Gotowe do odbioru'
        };
        return statusMap[statusId] || 'Nieznany';
    }
}

export const API = new APIService(); 

// Funkcje sprawdzające status
export async function checkApiStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
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
        const response = await fetch(`${API_BASE_URL}/orders?limit=1`);
        return response.ok;
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