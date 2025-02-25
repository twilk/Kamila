import { BaseManager } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';

const ORDER_STATUSES = {
    UNTOUCHED: ['1', '2'],
    CALLED: ['3', '4'],
    READY: ['5', '8', '13'],
    OVERDUE: {
        STATUSES: ['1', '2', '3', '4', '5', '8', '13'],
        MIN_DAYS: 3,
        MAX_DAYS: 7
    },
    CRITICAL: {
        STATUSES: ['1', '2', '3', '4', '5', '8', '13'],
        MIN_DAYS: 7
    }
};

const API_CONFIG = {
    BASE_URL: 'https://darwina.pl/api',
    ENDPOINTS: {
        ORDERS: '/orders',
        AUTH: '/auth/token'
    }
};

class OrderService extends BaseManager {
    #credentials = null;
    #storage = null;
    #tokenRefreshPromise = null;
    #lastTokenRefresh = 0;
    #tokenRefreshInterval = 30 * 60 * 1000; // 30 minutes
    static #instance = null;
    static _registry = null;

    #getCacheKey(storeId) {
        return `orders_${storeId || 'ALL'}`;
    }

    constructor(registry) {
        if (OrderService.#instance) {
            return OrderService.#instance;
        }
        super(registry, 'OrderService');
        OrderService.#instance = this;
        OrderService._registry = registry;
        
        this.addDependency('storage');
        this.addDependency('api');
        this.addDependency('error');
    }

    static getInstance() {
        if (!OrderService.#instance && OrderService._registry) {
            OrderService.#instance = new OrderService(OrderService._registry);
        }
        return OrderService.#instance;
    }

    static setRegistry(registry) {
        OrderService._registry = registry;
    }

    async #checkCache(storeId) {
        const key = this.#getCacheKey(storeId);
        try {
            const cache = await this.#storage.get(key);
            if (!cache) return null;

            const now = Date.now();
            const cacheAge = now - cache.timestamp;
            const TTL = 5 * 60 * 1000; // 5 minutes

            if (cacheAge > TTL) {
                await this.#storage.remove(key);
                return null;
            }

            return cache.data;
        } catch (error) {
            return null;
        }
    }

    async #refreshToken() {
        if (this.#tokenRefreshPromise) {
            return this.#tokenRefreshPromise;
        }
        
        try {
            this.log(LogLevel.INFO, '🔄 Refreshing API token...');
            
            this.#tokenRefreshPromise = (async () => {
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.#credentials)
                });
                
                if (!response.ok) {
                    throw new Error(`Token refresh failed: ${response.status}`);
                }
                
                const data = await response.json();
                this.#credentials.token = data.access_token;
                this.#lastTokenRefresh = Date.now();
            })();
            
            await this.#tokenRefreshPromise;
            this.log(LogLevel.SUCCESS, '✅ Token refreshed');
        } catch (error) {
            this.handleError(error, ErrorType.AUTH, ErrorSeverity.HIGH);
            throw error;
        } finally {
            this.#tokenRefreshPromise = null;
        }
    }

    async #fetchOrdersRecursively(url, page = 1, allOrders = []) {
        try {
            url.searchParams.set('page', page.toString());
            
            console.log('💩 [API] Fetching page:', { page, totalSoFar: allOrders.length });
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.#credentials.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.#refreshToken();
                    return this.#fetchOrdersRecursively(url, page, allOrders);
                }
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('💩 [API] Raw response:', {
                dataLength: data.data?.length,
                total_count: data.total_count,
                page: data.page,
                per_page: data.per_page,
                sample: data.data?.slice(0, 2)
            });
            
            if (!data?.data || !Array.isArray(data.data)) {
                throw new Error('Invalid response format');
            }

            const orders = [...allOrders, ...data.data];
            
            // Check if there are more pages
            const hasMorePages = data.data.length === 50; // If we got full page, there might be more
            
            console.log('💩 [API] Page received:', {
                page,
                ordersInPage: data.data.length,
                totalSoFar: orders.length,
                hasMorePages
            });

            if (hasMorePages) {
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between pages
                return this.#fetchOrdersRecursively(url, page + 1, orders);
            }
            
            return orders;
        } catch (error) {
            console.log('💩 [API] Error fetching page:', { page, error });
            if (allOrders.length > 0) {
                return allOrders; // Return what we have if error occurs mid-way
            }
            throw error;
        }
    }

    async getOrderStatuses(storeId, options = {}) {
        const { forceRefresh = false } = options;
        
        console.log('💩 [API] Getting order statuses:', { storeId, forceRefresh });
        
        if (!forceRefresh) {
            const cachedData = await this.#checkCache(storeId);
            if (cachedData) {
                console.log('💩 [API] Using cached data:', cachedData);
                return cachedData;
            }
        }

        try {
            if (Date.now() - this.#lastTokenRefresh >= this.#tokenRefreshInterval) {
                console.log('💩 [API] Token expired, refreshing...');
                await this.#refreshToken();
            }

            const allOrders = [];
            const statuses = [...new Set([
                ...ORDER_STATUSES.UNTOUCHED,
                ...ORDER_STATUSES.CALLED,
                ...ORDER_STATUSES.READY
            ])];
            
            // Combine all statuses into one request
            const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS}`);
            url.searchParams.set('status_id', statuses.join(','));
            url.searchParams.set('limit', '50');

            if (storeId && storeId !== 'ALL') {
                const storeManager = await this.getDependency('store');
                const store = await storeManager.getStore(storeId);
                if (store?.deliveryId) {
                    url.searchParams.set('delivery_id', store.deliveryId.toString());
                }
            }

            console.log('💩 [API] Fetching orders for all statuses:', { url: url.toString() });

            const orders = await this.#fetchOrdersRecursively(url);
            allOrders.push(...orders);

            console.log('💩 [API] All orders received:', {
                total: allOrders.length,
                byStatus: allOrders.reduce((acc, order) => {
                    const status = order.status_id?.toString() || 'unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {})
            });

            // Initialize counters
            const counts = {
                untouched: 0,
                called: 0,
                ready: 0,
                overdue: 0,
                critical: 0
            };

            console.log('💩 [API] Counting orders by status...');
            for (const order of allOrders) {
                const statusId = (order.status_id || '').toString();
                const orderDate = order.ready_date ? new Date(order.ready_date) : 
                                order.date ? new Date(order.date) : null;
                
                console.log('💩 [API] Processing order:', {
                    id: order.order_id,
                    status: statusId,
                    date: orderDate?.toISOString()
                });
                
                // Check if order is overdue or critical
                if (orderDate) {
                    const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (24 * 60 * 60 * 1000));
                    
                    if (daysSinceOrder >= ORDER_STATUSES.CRITICAL.MIN_DAYS) {
                        counts.critical++;
                        console.log('💩 [API] Order is critical:', {
                            id: order.order_id,
                            days: daysSinceOrder
                        });
                    } else if (daysSinceOrder >= ORDER_STATUSES.OVERDUE.MIN_DAYS) {
                        counts.overdue++;
                        console.log('💩 [API] Order is overdue:', {
                            id: order.order_id,
                            days: daysSinceOrder
                        });
                    }
                }
                
                // Count by basic status
                if (ORDER_STATUSES.UNTOUCHED.includes(statusId)) {
                    counts.untouched++;
                } else if (ORDER_STATUSES.CALLED.includes(statusId)) {
                    counts.called++;
                } else if (ORDER_STATUSES.READY.includes(statusId)) {
                    counts.ready++;
                }
            }

            console.log('💩 [API] Final counts:', counts);

            const result = {
                success: true,
                counts,
                timestamp: Date.now()
            };

            // Cache the results
            await this.#storage.set(this.#getCacheKey(storeId), {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
        } catch (error) {
            console.log('💩 [API] Error getting order statuses:', error);
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export both class and instance
export { OrderService };
export const orderService = OrderService.getInstance(); 