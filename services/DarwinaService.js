import { logService } from './LogService.js';
import { cacheManagerService } from './CacheManagerService.js';
import { notification } from '../components/Notification.js';
import { API_CONFIG, API_BASE_URL, getDarwinaCredentials } from '../config/api.js';
import { googleSheetsService } from './GoogleSheetsService.js';
import { storeService } from './StoreService.js';

export class DarwinaService {
    constructor() {
        this.initialized = false;
        this.devBypassAuth = false; // Tryb deweloperski
        this.authToken = null;
        this.baseUrl = API_BASE_URL;
        logService.info('DarwinaService constructed');
    }

    async initialize() {
        if (this.initialized) return;

        try {
            logService.info('Initializing DarwinaService...');
            
            // Sprawdź czy jesteśmy w trybie deweloperskim
            try {
                const { devMode } = await chrome.storage.local.get('devMode');
                this.devBypassAuth = devMode === true;
                if (this.devBypassAuth) {
                    logService.info('Development mode enabled - bypassing authorization');
                }
            } catch (error) {
                logService.warn('Failed to check dev mode:', error);
            }

            // Pobierz i ustaw token
            if (!this.devBypassAuth) {
                try {
                    const credentials = await getDarwinaCredentials();
                    if (credentials && credentials.DARWINA_API_KEY) {
                        await this.setAuthToken(credentials.DARWINA_API_KEY);
                        logService.info('Auth token obtained and saved');
                    } else {
                        logService.error('Failed to obtain auth token');
                    }
                } catch (error) {
                    logService.error('Error getting credentials:', error);
                }
            }
            
            this.initialized = true;
            logService.info('DarwinaService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize DarwinaService:', error);
            throw error;
        }
    }

    async checkAuthorization() {
        try {
            // W trybie deweloperskim zawsze zwracamy true
            if (this.devBypassAuth) {
                return true;
            }

            // Sprawdź czy mamy token
            if (!this.authToken) {
                logService.warn('No auth token available');
                return false;
            }

            // Sprawdź czy mamy wybrany sklep
            const selectedStore = await storeService.getCurrentStore();
            if (!selectedStore) {
                logService.warn('No store selected');
                return false;
            }

            // Spróbuj pobrać zamówienia - jeśli się uda, to znaczy że mamy autoryzację
            const orders = await this.getOrders(selectedStore);
            return !!orders;
        } catch (error) {
            logService.error('Authorization check failed:', error);
            return false;
        }
    }

    async fetchWithRetry(endpoint, options = {}, forceRefresh = false) {
        const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
        const fullUrl = `${this.baseUrl}${endpoint}`;
        
        // Log request details
        logService.debug('API Request:', {
            url: fullUrl,
            method: options.method || 'GET',
            forceRefresh,
            cacheKey,
            headers: {
                ...options.headers,
                Authorization: this.authToken ? 'Bearer [PRESENT]' : '[MISSING]'
            },
            store: await storeService.getCurrentStore()
        });
        
        // Try cache first if not forcing refresh
        if (!forceRefresh) {
        try {
            const cachedData = await cacheManagerService.get(cacheKey);
            if (cachedData) {
                    logService.debug(`Cache hit for ${endpoint}`, {
                        url: fullUrl,
                        cacheKey,
                        dataSize: JSON.stringify(cachedData).length,
                        data: cachedData
                    });
                return cachedData;
            }
        } catch (error) {
            logService.warn(`Cache error for ${endpoint}:`, error);
            }
        }

        let lastError;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                logService.debug(`API attempt ${attempt + 1}/3 for ${fullUrl}`, {
                    attempt: attempt + 1,
                    forceRefresh,
                    store: await storeService.getCurrentStore(),
                    headers: {
                        Authorization: this.authToken ? 'Bearer [PRESENT]' : '[MISSING]',
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });

                // First, send OPTIONS request
                const optionsResponse = await fetch(fullUrl, {
                    method: 'OPTIONS',
                    headers: {
                        'Origin': window.location.origin,
                        'Access-Control-Request-Method': 'GET',
                        'Access-Control-Request-Headers': 'authorization,content-type'
                    }
                });

                if (!optionsResponse.ok) {
                    throw new Error(`OPTIONS request failed: ${optionsResponse.status}`);
                }

                logService.debug('OPTIONS request successful');

                // Wait a bit after OPTIONS
                await new Promise(resolve => setTimeout(resolve, 100));

                // Then send the actual GET request
                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Origin': window.location.origin
                    },
                    ...options
                });

                logService.debug(`API Response received:`, {
                    status: response.status,
                    ok: response.ok,
                    statusText: response.statusText,
                    headers: Object.fromEntries([...response.headers])
                });

                if (response.status === 401) {
                    this.authToken = null;
                    const credentials = await getDarwinaCredentials();
                    if (credentials?.DARWINA_API_KEY) {
                        await this.setAuthToken(credentials.DARWINA_API_KEY);
                        continue;
                    }
                    throw new Error('Failed to refresh authentication token');
                }

                if (!response.ok) {
                    const responseText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
                }

                const data = await response.json();
                
                // Log successful response
                logService.debug('API Response data:', {
                    url: fullUrl,
                    status: response.status,
                    dataSize: JSON.stringify(data).length,
                    hasData: !!data,
                    isArray: Array.isArray(data),
                    firstItem: Array.isArray(data) ? data[0] : null,
                    store: await storeService.getCurrentStore()
                });
                
                // Cache successful response if not forcing refresh
                if (!forceRefresh) {
                try {
                    await cacheManagerService.set(cacheKey, data, 5 * 60 * 1000);
                        logService.debug(`Cached response for ${endpoint}`, {
                            url: fullUrl,
                            cacheKey,
                            ttl: '5 minutes',
                            dataSize: JSON.stringify(data).length
                        });
                } catch (error) {
                    logService.warn(`Cache set error for ${endpoint}:`, error);
                    }
                }
                
                return data;
            } catch (error) {
                lastError = error;
                logService.warn(`API attempt ${attempt + 1} failed:`, {
                    url: fullUrl,
                    error: error.message,
                    stack: error.stack,
                    endpoint,
                    method: options.method || 'GET',
                    store: await storeService.getCurrentStore()
                });

                if (error.message.includes('Failed to refresh authentication')) {
                    break;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        // Try stale cache as fallback if not forcing refresh
        if (!forceRefresh) {
        try {
            const cachedData = await cacheManagerService.get(cacheKey);
            if (cachedData) {
                    logService.warn(`Using stale cache for ${endpoint} after all retries failed`, {
                        url: fullUrl,
                        cacheKey,
                        error: lastError.message,
                        dataSize: JSON.stringify(cachedData).length
                    });
                return cachedData;
            }
        } catch (error) {
            logService.warn(`Cache fallback error for ${endpoint}:`, error);
            }
        }

        throw lastError;
    }

    async getOrders(storeId, forceRefresh = false) {
        try {
            logService.debug('getOrders called:', {
                storeId,
                forceRefresh,
                baseUrl: this.baseUrl,
                endpoint: API_CONFIG.DARWINA.ENDPOINTS.ORDERS,
                fullUrl: `${this.baseUrl}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?store=${storeId}`
            });

            const endpoint = `${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?store=${storeId}`;
            logService.debug('Fetching orders:', {
                endpoint,
                storeId,
                forceRefresh,
                authToken: this.authToken ? 'present' : 'missing'
            });

            const response = await this.fetchWithRetry(
                endpoint,
                {},
                forceRefresh
            );

            logService.debug('Orders API raw response:', {
                responseType: typeof response,
                isArray: Array.isArray(response),
                hasValue: !!response?.value,
                hasData: !!response?.data,
                length: Array.isArray(response) ? response.length : 0
            });

            // Sprawdź różne formaty odpowiedzi
            let orders = [];
            if (response?.value?.data) {
                // Format 1: { value: { data: [...] } }
                orders = response.value.data;
                logService.debug('Using response.value.data format');
            } else if (response?.data && Array.isArray(response.data)) {
                // Format 2: { data: [...] }
                orders = response.data;
                logService.debug('Using response.data format');
            } else if (Array.isArray(response)) {
                // Format 3: [...]
                orders = response;
                logService.debug('Using direct array format');
            }

            // Sprawdź czy mamy tablicę
            if (!Array.isArray(orders)) {
                logService.error('Orders data is not an array:', { 
                    responseType: typeof response,
                    ordersType: typeof orders,
                    response: JSON.stringify(response).substring(0, 200) + '...',
                    storeId
                });
                return [];
            }

            logService.debug('Parsed orders:', { 
                count: orders.length,
                firstOrder: orders[0],
                statusCounts: orders.reduce((acc, order) => {
                    acc[order.status_id] = (acc[order.status_id] || 0) + 1;
                    return acc;
                }, {}),
                storeId
            });

            return orders;
        } catch (error) {
            logService.error('Failed to fetch orders:', {
                error: error.message,
                stack: error.stack,
                storeId,
                baseUrl: this.baseUrl,
                endpoint: API_CONFIG.DARWINA.ENDPOINTS.ORDERS
            });
            return [];
        }
    }

    async setAuthToken(token) {
        try {
            this.authToken = token;
            await chrome.storage.local.set({ authToken: token });
            logService.info('Auth token saved successfully');
            return true;
        } catch (error) {
            logService.error('Failed to save auth token:', error);
            return false;
        }
    }

    cleanup() {
        logService.debug('Cleaning up DarwinaService...');
        this.initialized = false;
        this.authToken = null;
        logService.debug('DarwinaService cleaned up');
    }

    async getData(forceRefresh = false) {
        try {
            // Get current store from StoreService
            const selectedStore = await storeService.getCurrentStore();
            if (!selectedStore) {
                throw new Error('No store selected');
            }

            logService.debug('Fetching data for store:', { 
                selectedStore, 
                forceRefresh,
                baseUrl: this.baseUrl,
                endpoint: API_CONFIG.DARWINA.ENDPOINTS.ORDERS
            });

            // Clear cache if force refresh
            if (forceRefresh) {
                const cacheKey = `${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?store=${selectedStore}`;
                await cacheManagerService.delete(cacheKey);
                logService.debug('Cache cleared for store:', {
                    store: selectedStore,
                    cacheKey,
                    endpoint: API_CONFIG.DARWINA.ENDPOINTS.ORDERS
                });
            }

            // Log API configuration
            logService.debug('API Configuration:', {
                baseUrl: this.baseUrl,
                ordersEndpoint: API_CONFIG.DARWINA.ENDPOINTS.ORDERS,
                fullUrl: `${this.baseUrl}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?store=${selectedStore}`,
                store: selectedStore,
                forceRefresh
            });

            // Fetch all data in parallel
            const [orders, drwnData, rankingData] = await Promise.all([
                this.getOrders(selectedStore, forceRefresh),
                googleSheetsService.getDRWNData(selectedStore),
                googleSheetsService.getRankingData()
            ]);

            // Debug log orders data
            logService.debug('Raw orders data:', {
                    ordersCount: orders.length,
                firstOrder: orders[0],
                allOrders: orders, // Log all orders for debugging
                statusCounts: orders.reduce((acc, order) => {
                    acc[order.status_id] = (acc[order.status_id] || 0) + 1;
                    return acc;
                }, {}),
                forceRefresh,
                store: selectedStore,
                endpoint: `${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?store=${selectedStore}`
            });

            // Count orders by status with single pass
            const counters = orders.reduce((acc, order) => {
                // Update status counters
                switch (order.status_id) {
                    case 1: // Złożone
                        acc.submitted++;
                        break;
                    case 2: // Potwierdzone przez Klienta
                        acc.confirmed++;
                        break;
                    case 3: // Przyjęte do realizacji w sklepie
                        acc.accepted++;
                        break;
                    case 5: // Gotowe do odbioru w sklepie
                        acc.ready++;
                        // Check for overdue (ready but older than 2 weeks)
                        const readyDate = new Date(order.ready_date);
                        const twoWeeksAgo = new Date();
                        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                        if (readyDate < twoWeeksAgo) {
                            acc.overdue++;
                        }
                        break;
                }
                return acc;
            }, {
                submitted: 0,
                confirmed: 0,
                accepted: 0,
                ready: 0,
                overdue: 0
            });

            logService.debug('Order counters calculated:', {
                counters,
                totalOrders: orders.length,
                statusCounts: orders.reduce((acc, order) => {
                    if ([1, 2, 3, 5].includes(order.status_id)) {
                        acc[order.status_id] = (acc[order.status_id] || 0) + 1;
                    }
                    return acc;
                }, {})
            });

            const result = {
                orders,
                drwn: drwnData,
                ranking: rankingData,
                ...counters
            };

            logService.debug('Returning data:', {
                hasOrders: !!result.orders,
                ordersCount: result.orders?.length || 0,
                counters: {
                        submitted: result.submitted,
                        confirmed: result.confirmed,
                        accepted: result.accepted,
                    ready: result.ready,
                    overdue: result.overdue
                    }
                });

                return result;
        } catch (error) {
            logService.error('Failed to get data:', {
                error: error.message,
                stack: error.stack,
                forceRefresh,
                store: await storeService.getCurrentStore(),
                baseUrl: this.baseUrl,
                endpoint: API_CONFIG.DARWINA.ENDPOINTS.ORDERS
            });
            throw error;
        }
    }
}

export const darwinaService = new DarwinaService(); 