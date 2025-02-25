import { BaseManager } from '../core/BaseManager.js';
import { LogLevel } from '../core/LogLevel.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';
import { API_CONFIG } from '../../config/api.js';
import { StorageManager } from '../core/StorageManager.js';

// Essential constants for status handling
const ORDER_STATUSES = {
    NEW: '1',
    CONFIRMED: '2',
    ACCEPTED: '3',
    READY_FOR_PICKUP: '5'
};

const ORDER_STATUS_NAMES = {
    [ORDER_STATUSES.NEW]: 'Nowe',
    [ORDER_STATUSES.CONFIRMED]: 'Potwierdzone',
    [ORDER_STATUSES.ACCEPTED]: 'Przyjęte',
    [ORDER_STATUSES.READY_FOR_PICKUP]: 'Gotowe'
};

// Keys matching HTML data-status attributes
const COUNTER_KEYS = {
    '1': '1',           // data-status="1"
    '2': '2',           // data-status="2"
    '3': '3',           // data-status="3"
    'ready': 'ready',     // data-status="ready"
    'overdue': 'overdue'  // data-status="overdue"
};

/**
 * Service for managing orders from the DARWINA API
 * @extends BaseManager
 */
class OrderService extends BaseManager {
    #credentials = null;
    #storage = null;
    #tokenRefreshPromise = null;
    #lastTokenRefresh = 0;
    #tokenRefreshInterval = 30 * 60 * 1000; // 30 minutes
    static #instance = null;
    static _registry = null;
    
    constructor(registry) {
        if (OrderService.#instance) {
            return OrderService.#instance;
        }
        super(registry, 'order');
        OrderService.#instance = this;
        OrderService._registry = registry;
        this.#storage = StorageManager.getInstance();
        
        this.addDependency('storage');
        this.addDependency('api');
        this.addDependency('error');
    }
    
    static getInstance() {
        if (!OrderService.#instance) {
            throw new Error('OrderService not initialized');
        }
        return OrderService.#instance;
    }

    static setRegistry(registry) {
        OrderService._registry = registry;
    }
    
    #getCacheKey(storeId) {
        return `counters_${storeId || 'ALL'}`;
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

            return {
                success: true,
                counts: cache.counts,
                timestamp: cache.timestamp
            };
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
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials',
                        scope: 'READWRITE',
                        client_id: this.#credentials.client_id,
                        client_secret: this.#credentials.client_secret
                    }).toString()
                });
                
                if (!response.ok) {
                    this.log(LogLevel.ERROR, '❌ Token refresh failed', {
                        status: response.status,
                        statusText: response.statusText
                    });
                    throw new Error(`Token refresh failed: ${response.status}`);
                }
                
                const data = await response.json();
                this.#credentials.token = data.access_token;
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
    
    async #fetchPage(url, page) {
        url.searchParams.set('page', page.toString());
        if (!url.searchParams.has('limit')) {
            url.searchParams.set('limit', '50');
        }
        
        this.log(LogLevel.INFO, '🔗 API Request URL:', {
            url: url.toString(),
            page
        });
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.#credentials.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.log(LogLevel.WARN, '⚠️ Token expired during request, refreshing...');
                await this.#refreshToken();
                return this.#fetchPage(url, page);
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
            this.log(LogLevel.ERROR, '❌ Invalid response format:', {
                type: typeof data,
                value: data
            });
            throw new Error('Invalid response format: expected {data: Order[]}');
        }

        const perPage = parseInt(url.searchParams.get('limit')) || 50;
        const currentPage = page;
        const ordersInPage = data.data.length;
        
        const hasMorePages = ordersInPage >= perPage;
        const totalPages = hasMorePages ? page + 1 : page;

        console.log('💩 [API] Page info:', {
            currentPage,
            perPage,
            ordersInPage,
            hasMorePages,
            totalPages
        });

        return {
            orders: data.data,
            page: currentPage,
            totalPages,
            perPage,
            hasMorePages
        };
    }

    async #fetchOrdersRecursively(url, page = 1, allOrders = []) {
        try {
            console.log('💩 [API] Fetching page:', { page, totalSoFar: allOrders.length });
            const result = await this.#fetchPage(url, page);
            
            const orders = [...allOrders, ...result.orders];
            
            console.log('💩 [API] Page received:', {
                page: result.page,
                ordersInPage: result.orders.length,
                totalSoFar: orders.length,
                hasMorePages: result.hasMorePages
            });

            if (result.hasMorePages && result.orders.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
                return this.#fetchOrdersRecursively(url, page + 1, orders);
            }
            
            return orders;
        } catch (error) {
            console.log('💩 [API] Error fetching page:', { page, error });
            if (allOrders.length > 0) {
                console.log('💩 [API] Returning partial results:', { count: allOrders.length });
                return allOrders;
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
            const statuses = ['1', '2', '3', '5'];
            
            const statusPromises = statuses.map(async status => {
                const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS}`);
                
                url.searchParams.set('status_id', status);
                url.searchParams.set('limit', '50');

                if (storeId && storeId !== 'ALL') {
                    const storeManager = await this.getDependency('store');
                    const store = await storeManager.getStore(storeId);
                    if (store?.deliveryId) {
                        url.searchParams.set('delivery_id', store.deliveryId.toString());
                    }
                }

                console.log('💩 [API] Fetching orders for status:', { status, url: url.toString() });

                const statusOrders = await this.#fetchOrdersRecursively(url);
                return statusOrders;
            });

            const results = await Promise.all(statusPromises);
            
            results.forEach(orders => allOrders.push(...orders));

            console.log('💩 [API] All orders received:', {
                total: allOrders.length,
                byStatus: allOrders.reduce((acc, order) => {
                    const status = order.status_id?.toString() || 'unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {})
            });

            const counts = {
                '1': 0,
                '2': 0,
                '3': 0,
                'ready': 0,
                'overdue': 0
            };

            console.log('💩 [API] Counting orders by status...');
            for (const order of allOrders) {
                const statusId = (order.status_id || '').toString();
                
                console.log('💩 [API] Processing order:', {
                    id: order.order_id,
                    status: statusId,
                    date: order.date
                });
                
                if (statusId === '5') {
                    const orderDate = order.ready_date ? new Date(order.ready_date) : 
                                    order.date ? new Date(order.date) : null;
                    
                    console.log('💩 [API] Processing status 5 order:', {
                        id: order.order_id,
                        ready_date: order.ready_date,
                        date: order.date,
                        orderDateObj: orderDate,
                        isNull: !orderDate
                    });
                    
                    if (!orderDate) {
                        counts['ready']++;
                        console.log('💩 [API] No date available, counting as ready');
                        continue;
                    }
                    
                    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
                    if (orderDate < twoWeeksAgo) {
                        counts['overdue']++;
                        console.log('💩 [API] Order is overdue:', {
                            id: order.order_id,
                            orderDate,
                            twoWeeksAgo,
                            diff: Math.floor((Date.now() - orderDate) / (24 * 60 * 60 * 1000)) + ' days'
                        });
                    } else {
                        counts['ready']++;
                        console.log('💩 [API] Order is ready (not overdue):', {
                            id: order.order_id,
                            orderDate,
                            twoWeeksAgo,
                            diff: Math.floor((Date.now() - orderDate) / (24 * 60 * 60 * 1000)) + ' days'
                        });
                    }
                } else if (statusId && counts.hasOwnProperty(statusId)) {
                    counts[statusId]++;
                    console.log('💩 [API] Counted order with status:', {
                        id: order.order_id,
                        status: statusId,
                        currentCount: counts[statusId]
                    });
                } else {
                    console.log('💩 [API] Skipped order with invalid status:', {
                        id: order.order_id,
                        status: statusId
                    });
                }
            }

            console.log('💩 [API] Final counts:', counts);

            const cacheData = {
                counts,
                timestamp: Date.now()
            };
            
            const cacheKey = this.#getCacheKey(storeId);
            console.log('💩 [API] Saving to cache:', { key: cacheKey, data: cacheData });
            await this.#storage.set(cacheKey, cacheData);
            
            return {
                success: true,
                counts,
                timestamp: cacheData.timestamp
            };
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
            await this.#loadCredentials();
            this.log(LogLevel.SUCCESS, '✅ Order service initialized');
            return true;
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Order service initialization failed', {
                error: error.message
            });
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    async #loadCredentials() {
        try {
            this.log(LogLevel.INFO, '🔑 Loading credentials...');
            const response = await fetch(chrome.runtime.getURL('config/credentials.json'));
            if (!response.ok) {
                throw new Error(`Failed to load credentials: ${response.statusText}`);
            }
            const credentials = await response.json();
            if (!credentials?.client_id || !credentials?.client_secret) {
                throw new Error('Invalid credentials format');
            }
            this.#credentials = credentials;
            this.log(LogLevel.INFO, '🔑 Credentials loaded, getting initial token...');
            await this.#refreshToken();
            return true;
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Failed to load credentials', {
                error: error.message
            });
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            throw error;
        }
    }
}

export { OrderService };

export const createOrderService = Object.assign(
    (registry) => {
        if (!OrderService._registry) {
            OrderService.setRegistry(registry);
        }
        return new OrderService(registry);
    },
    { setRegistry: (registry) => OrderService.setRegistry(registry) }
);