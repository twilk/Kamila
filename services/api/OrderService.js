import { BaseManager } from '../core/BaseManager.js';
import { LogLevel } from '../core/LogLevel.js';
import { ErrorType, ErrorSeverity } from '../core/ErrorTypes.js';
import { API_CONFIG } from '../../config/api.js';
import { StorageManager } from '../core/StorageManager.js';

// Essential constants for status handling
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

const ORDER_STATUS_NAMES = {
    untouched: 'Nieruszone',
    called: 'Obdzwonione',
    ready: 'Gotowe',
    overdue: 'Zaległe',
    critical: 'Dramat'
};

// Keys matching HTML data-status attributes
const COUNTER_KEYS = {
    untouched: 'untouched',
    called: 'called',
    ready: 'ready',
    overdue: 'overdue',
    critical: 'critical'
};

// Cache configuration
const CACHE_CONFIG = {
    TTL: 5 * 60 * 1000, // 5 minutes
    KEYS: {
        COUNTERS: 'counters_v2_',
        LAST_VERSION: 'last_cache_version'
    }
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
        const totalPages = Math.ceil(data.total_count / perPage);
        const hasMorePages = currentPage < totalPages;

        console.log('💩 [API] Page info:', {
            currentPage,
            perPage,
            ordersInPage,
            totalPages,
            hasMorePages,
            totalCount: data.total_count
        });

        return {
            orders: data.data,
            page: currentPage,
            totalPages,
            perPage,
            hasMorePages,
            totalCount: data.total_count
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
            const statuses = [...new Set([
                ...ORDER_STATUSES.UNTOUCHED,
                ...ORDER_STATUSES.CALLED,
                ...ORDER_STATUSES.READY
            ])];
            
            const statusPromises = statuses.map(async status => {
                const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS}`);
                
                url.searchParams.set('status_id', status);
                url.searchParams.set('limit', '50'); // Ustawiamy stały limit 50

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

    // Add new methods for packing requests
    async getPackingRequests() {
        try {
            // Get orders for the two specific stores that handle shipping
            const shippingStores = ['store1_id', 'store2_id']; // Replace with actual store IDs
            const requests = [];

            for (const storeId of shippingStores) {
                const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS}`);
                url.searchParams.set('store_id', storeId);
                url.searchParams.set('status', 'pending');
                url.searchParams.set('limit', '50');

                const orders = await this.#fetchOrdersRecursively(url);
                
                // Transform orders into packing requests
                const storeRequests = orders.map(order => ({
                    id: order.id,
                    store: {
                        id: storeId,
                        name: order.store_name
                    },
                    products: order.items.map(item => ({
                        id: item.product_id,
                        name: item.name,
                        quantity: item.quantity,
                        ean: item.ean
                    })),
                    isShipping: order.shipping_method !== null,
                    packed: order.status === 'packed',
                    created_at: order.created_at
                }));

                requests.push(...storeRequests);
            }

            return {
                success: true,
                data: requests
            };
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async confirmPacking(request) {
        try {
            // Generate exchange file content
            const fileContent = this.#generateExchangeFile(request);
            
            // Upload to FTP
            const ftpResult = await this.#uploadToFTP(fileContent.filename, fileContent.content);
            
            if (!ftpResult.success) {
                throw new Error('Failed to upload exchange file to FTP');
            }

            // Update order status
            const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS}/${request.id}`);
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.#credentials.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'packed'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update order status: ${response.status}`);
            }

            return {
                success: true
            };
        } catch (error) {
            this.handleError(error, ErrorType.API, ErrorSeverity.HIGH);
            return {
                success: false,
                error: error.message
            };
        }
    }

    #generateExchangeFile(request) {
        const now = new Date();
        const formattedDate = now.toLocaleDateString('pl-PL');
        
        // Generate unique file name
        const filename = `RW_wydanie_${request.store.id}-${request.id}_1.txt`;
        
        // Generate content based on the template
        const content = `TypPolskichLiter:LA
TypDok:RW
NrDok:RW_${request.store.id}-${request.id}
Data:${formattedDate}
Magazyn:${request.store.name}
SposobPlatn:GOT
TerminPlatn:0
IndeksCentralny:NIE
NazwaWystawcy:Darwina.pl Retail Sp. z o.o
AdresWystawcy:W•wozowa 6/4B, 02-796 Warszawa
KodWystawcy:02-796
PocztaWystawcy:
MiastoWystawcy:Warszawa
UlicaWystawcy:W•wozowa 6/4B
NrDomuWystawcy:6
NrLokaluWystawcy:4B
NazwaUlicyWystawcy:W•wozowa
GminaWystawcy:Warszawa
PowiatWystawcy:Warszawa
WojewodztwoWystawcy:mazowieckie
KodKrajuWystawcy:PL
NIPWystawcy:9512387656
BankWystawcy:mBank
KontoWystawcy:50 1140 2004 0000 3102 7760 2647
TelefonWystawcy:+48 888 160 888
NrWystawcyWSieciSklepow:${request.store.id}
WystawcaToCentralaSieci:0
NrWystawcyObcyWSieciSklepow:
IloscLinii:${request.products.length}
${request.products.map(product => {
    const netValue = (product.quantity * product.price).toFixed(2);
    const grossValue = (product.quantity * product.price * 1.23).toFixed(2);
    return `Linia:Nazwa{${product.name}}Kod{${product.ean}}Vat{23}Jm{szt}Asortyment{${product.category || 'INNE'}}Sww{}PKWiU{}Ilosc{${product.quantity}}Cena{n${product.price}}Wartosc{n${netValue}}IleWOpak{1}CenaSp{b${grossValue}}TowId{${product.id}}`;
}).join('\n')}
Stawka:Vat{23}SumaNet{${request.products.reduce((sum, p) => sum + p.quantity * p.price, 0).toFixed(2)}}SumaVat{${(request.products.reduce((sum, p) => sum + p.quantity * p.price * 0.23, 0)).toFixed(2)}}
DoZaplaty:${(request.products.reduce((sum, p) => sum + p.quantity * p.price * 1.23, 0)).toFixed(2)}`;

        return { filename, content };
    }

    async #uploadToFTP(filename, content) {
        try {
            const ftpConfig = await this.#getFTPConfig();
            
            // Create FTP client
            const ftpClient = new (require('ftp'))();
            
            return new Promise((resolve, reject) => {
                ftpClient.on('ready', () => {
                    ftpClient.put(Buffer.from(content), filename, (err) => {
                        ftpClient.end();
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ success: true });
                        }
                    });
                });

                ftpClient.on('error', (err) => {
                    ftpClient.end();
                    reject(err);
                });

                ftpClient.connect(ftpConfig);
            });
        } catch (error) {
            this.handleError(error, ErrorType.FTP, ErrorSeverity.HIGH);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async #getFTPConfig() {
        // Get FTP configuration from storage
        const storage = await this.getDependency('storage');
        const config = await storage.get('ftp_config');
        
        if (!config) {
            throw new Error('FTP configuration not found');
        }
        
        return config;
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