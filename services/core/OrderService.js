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
        AUTH: '/auth/access_token'
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
        super(registry, 'order');
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
                const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}`;
                this.log(LogLevel.DEBUG, '📡 Token request', { url });
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials',
                        scope: 'READWRITE',
                        client_id: this.#credentials.client_id,
                        client_secret: this.#credentials.client_secret
                    }).toString()
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    this.log(LogLevel.ERROR, '❌ Token refresh failed', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorText
                    });
                    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
                }
                
                const data = await response.json();
                this.#credentials = {
                    ...this.#credentials,
                    DARWINA_API_KEY: data.access_token,  // Store with same key as old solution
                    token: data.access_token  // Keep for backward compatibility
                };
                this.#lastTokenRefresh = Date.now();
                
                this.log(LogLevel.SUCCESS, '✅ Token refreshed successfully');
            })();
            
            await this.#tokenRefreshPromise;
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
                    'Authorization': `Bearer ${this.#credentials.DARWINA_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
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
            
            // Calculate page info
            const pageInfo = {
                currentPage: page,
                perPage: 50, // We know this from the limit parameter
                ordersInPage: data.data.length,
                totalPages: data.total_count ? Math.ceil(data.total_count / 50) : null,
                hasMorePages: data.data.length === 50, // If we got full page, there might be more
                totalSoFar: orders.length
            };
            
            console.log('💩 [API] Page info:', pageInfo);
            
            console.log('💩 [API] Page received:', {
                page: pageInfo.currentPage,
                ordersInPage: pageInfo.ordersInPage,
                totalSoFar: pageInfo.totalSoFar,
                hasMorePages: pageInfo.hasMorePages
            });

            if (pageInfo.hasMorePages) {
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

    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing order service...');
            
            // Get required dependencies
            const [storage, api, error] = await Promise.all([
                this.getDependency('storage'),
                this.getDependency('api'),
                this.getDependency('error')
            ]);

            // Validate dependencies
            if (!storage?.isInitialized()) throw new Error('Storage manager must be initialized');
            if (!api?.isInitialized()) throw new Error('API manager must be initialized');
            if (!error?.isInitialized()) throw new Error('Error manager must be initialized');

            // Load credentials from storage
            const credentials = await storage.get('api_credentials');
            if (!credentials?.client_id || !credentials?.client_secret) {
                throw new Error('API credentials not found');
            }
            this.#credentials = credentials;
            this.log(LogLevel.INFO, '🔑 Credentials loaded, getting initial token...');

            // Verify token refresh works
            try {
                await this.#refreshToken();
            } catch (tokenError) {
                this.log(LogLevel.ERROR, '❌ Failed to refresh token during initialization', { error: tokenError.message });
                // Don't mark as initialized if token refresh fails
                return false;
            }

            this.log(LogLevel.SUCCESS, '✅ Order service initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }
}

// Export both class and instance
export { OrderService };
export const orderService = OrderService.getInstance(); 