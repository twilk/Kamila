import { logService } from './LogService.js';
import { apiService } from './ApiService.js';
import { cacheService } from './CacheService.js';
import { API_CONFIG } from '../config/api.js';
import { stores } from '../config/stores.js';

/**
 * Service for interacting with DARWINA.PL API
 */
class DarwinaService {
    constructor() {
        this.baseUrl = API_CONFIG.DARWINA.BASE_URL;
        this.isInitialized = false;
        this.endpoints = API_CONFIG.DARWINA.ENDPOINTS;
        this.statusCodes = API_CONFIG.DARWINA.STATUS_CODES;
        this.devBypassAuth = true; // Development bypass flag
        this.users = new Map(); // Cache dla użytkowników
        logService.info('DarwinaService constructed');
    }

    async initialize() {
        if (this.isInitialized) {
            logService.debug('DarwinaService already initialized');
            return;
        }

        try {
            logService.info('Initializing DarwinaService...');
            await this.setupApiConfig();
            await this.loadUsers(); // Ładujemy użytkowników podczas inicjalizacji
            await this.checkAuthorization();
            this.isInitialized = true;
            logService.info('DarwinaService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize DarwinaService', error);
            // Don't throw here, continue with empty state
            this.isInitialized = true;
        }
    }

    async loadUsers() {
        try {
            // W trybie dev, wczytaj użytkowników z plików
            const userFiles = await this.getUserFiles();
            for (const file of userFiles) {
                const userData = await this.readUserFile(file);
                if (userData && userData.memberId) {
                    this.users.set(userData.memberId, userData);
                }
            }
            logService.debug(`Loaded ${this.users.size} users`);
        } catch (error) {
            logService.error('Failed to load users', error);
        }
    }

    async getUserFiles() {
        // TODO: Implement file system access to read users directory
        return ['84.json', '9.json']; // Przykładowa lista plików
    }

    async readUserFile(filename) {
        try {
            // TODO: Implement file reading
            // Na razie zwracamy przykładowe dane
            return {
                memberId: filename.replace('.json', ''),
                status: "Aktywny",
                fullName: "Example User",
                email: "example@email.com"
            };
        } catch (error) {
            logService.error(`Failed to read user file ${filename}`, error);
            return null;
        }
    }

    async setupApiConfig() {
        try {
            logService.debug('Setting up API configuration...');
            const config = await cacheService.get('darwinaConfig');
            
            if (config) {
                apiService.setBaseUrl(config.baseUrl || this.baseUrl);
                if (config.apiKey) {
                    apiService.setApiKey(config.apiKey);
                }
                logService.debug('API configuration loaded from cache');
            } else {
                apiService.setBaseUrl(this.baseUrl);
                logService.debug('Using default API configuration');
            }
        } catch (error) {
            logService.error('Failed to setup API configuration', error);
            throw error;
        }
    }

    async getOrders(params = {}) {
        try {
            logService.debug('Fetching orders...', params);
            const orders = await apiService.get('/orders', { params });
            logService.debug(`Fetched ${orders.length} orders`);
            return orders;
        } catch (error) {
            logService.error('Failed to fetch orders', error);
            throw error;
        }
    }

    async getOrder(id) {
        try {
            logService.debug('Fetching order details...', { id });
            const order = await apiService.get(`/orders/${id}`);
            logService.debug('Order details fetched successfully');
            return order;
        } catch (error) {
            logService.error('Failed to fetch order details', error);
            throw error;
        }
    }

    async updateOrder(id, data) {
        try {
            logService.debug('Updating order...', { id, data });
            const updatedOrder = await apiService.put(`/orders/${id}`, data);
            logService.info('Order updated successfully', { id });
            return updatedOrder;
        } catch (error) {
            logService.error('Failed to update order', error);
            throw error;
        }
    }

    async getProducts(params = {}) {
        try {
            logService.debug('Fetching products...', params);
            const products = await apiService.get('/products', { params });
            logService.debug(`Fetched ${products.length} products`);
            return products;
        } catch (error) {
            logService.error('Failed to fetch products', error);
            throw error;
        }
    }

    async getProduct(id) {
        try {
            logService.debug('Fetching product details...', { id });
            const product = await apiService.get(`/products/${id}`);
            logService.debug('Product details fetched successfully');
            return product;
        } catch (error) {
            logService.error('Failed to fetch product details', error);
            throw error;
        }
    }

    async updateProduct(id, data) {
        try {
            logService.debug('Updating product...', { id, data });
            const updatedProduct = await apiService.put(`/products/${id}`, data);
            logService.info('Product updated successfully', { id });
            return updatedProduct;
        } catch (error) {
            logService.error('Failed to update product', error);
            throw error;
        }
    }

    async getCustomers(params = {}) {
        try {
            logService.debug('Fetching customers...', params);
            const customers = await apiService.get('/customers', { params });
            logService.debug(`Fetched ${customers.length} customers`);
            return customers;
        } catch (error) {
            logService.error('Failed to fetch customers', error);
            throw error;
        }
    }

    async getCustomer(id) {
        try {
            logService.debug('Fetching customer details...', { id });
            const customer = await apiService.get(`/customers/${id}`);
            logService.debug('Customer details fetched successfully');
            return customer;
        } catch (error) {
            logService.error('Failed to fetch customer details', error);
            throw error;
        }
    }

    async updateCustomer(id, data) {
        try {
            logService.debug('Updating customer...', { id, data });
            const updatedCustomer = await apiService.put(`/customers/${id}`, data);
            logService.info('Customer updated successfully', { id });
            return updatedCustomer;
        } catch (error) {
            logService.error('Failed to update customer', error);
            throw error;
        }
    }

    async getUserData() {
        try {
            logService.debug('Fetching user data...');
            
            if (this.devBypassAuth) {
                // Return mock data in development mode
                return {
                    id: 'dev_user',
                    name: 'Development User',
                    role: 'admin'
                };
            }

            const isAuthorized = await this.checkAuthorization();
            
            if (!isAuthorized) {
                logService.warn('Failed to load initial user data, continuing with empty state');
                return null;
            }

            const userData = await apiService.get(this.endpoints.USER_DATA);
            logService.debug('User data fetched successfully');
            return userData;
        } catch (error) {
            logService.error('Failed to fetch user data', error);
            return null;
        }
    }

    async getUser() {
        try {
            logService.debug('Fetching user profile...');
            const user = await apiService.get(this.endpoints.USER);
            logService.debug('User profile fetched successfully');
            return user;
        } catch (error) {
            logService.error('Failed to fetch user profile', error);
            throw error;
        }
    }

    async updateUser(data) {
        try {
            logService.debug('Updating user profile...', { data });
            const updatedUser = await apiService.put(this.endpoints.USER, data);
            logService.info('User profile updated successfully');
            return updatedUser;
        } catch (error) {
            logService.error('Failed to update user profile', error);
            throw error;
        }
    }

    async checkAuthorization() {
        if (this.devBypassAuth) {
            logService.info('Development mode: Authentication bypass enabled');
            return true;
        }

        try {
            const token = await cacheService.get('authToken');
            if (!token) {
                logService.warn('No auth token found');
                return false;
            }

            apiService.setAuthToken(token);
            const isValid = await this.validateToken(token);
            
            if (!isValid) {
                logService.warn('Invalid or expired token');
                await this.refreshToken();
            }

            return true;
        } catch (error) {
            logService.error('Authorization check failed', error);
            return false;
        }
    }

    async validateToken(token) {
        try {
            const response = await apiService.get(this.endpoints.TOKEN, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.valid === true;
        } catch (error) {
            logService.error('Token validation failed', error);
            return false;
        }
    }

    async refreshToken() {
        try {
            const response = await apiService.post(this.endpoints.TOKEN);
            if (response.token) {
                await cacheService.set('authToken', response.token);
                apiService.setAuthToken(response.token);
                logService.info('Token refreshed successfully');
                return true;
            }
            return false;
        } catch (error) {
            logService.error('Failed to refresh token', error);
            return false;
        }
    }

    async getData() {
        try {
            logService.debug('Fetching all data...');
            
            // W trybie dev używamy lokalnych danych
            if (this.devBypassAuth) {
                const mockData = await this.getMockData();
                return mockData;
            }

            // W trybie produkcyjnym pobieramy z API
            const orders = await this.getOrders();
            const stock = await this.getProducts();
            const statusCounts = this.calculateStatusCounts(orders);
            
            return {
                orders,
                stock,
                ...statusCounts
            };
        } catch (error) {
            logService.error('Failed to fetch data', error);
            throw error;
        }
    }

    async getMockData() {
        try {
            // Generuj przykładowe zamówienia na podstawie sklepów i użytkowników
            const mockOrders = stores
                .filter(store => store.id !== 'ALL' && store.drwn)
                .map((store, index) => ({
                    number: `ORD${String(index + 1).padStart(3, '0')}`,
                    status: ['submitted', 'confirmed', 'accepted', 'ready'][Math.floor(Math.random() * 4)],
                    date: new Date(),
                    store: store.drwn,
                    user: Array.from(this.users.values())[Math.floor(Math.random() * this.users.size)]?.fullName || 'Unknown'
                }));

            // Generuj przykładowe stany magazynowe dla każdego sklepu
            const mockStock = stores
                .filter(store => store.id !== 'ALL' && store.drwn)
                .map((store, index) => ({
                    name: store.drwn,
                    quantity: Math.floor(Math.random() * 100),
                    lastUpdate: new Date()
                }));

            const statusCounts = this.calculateStatusCounts(mockOrders);

            return {
                orders: mockOrders,
                stock: mockStock,
                ...statusCounts
            };
        } catch (error) {
            logService.error('Failed to get mock data', error);
            throw error;
        }
    }

    async getStores() {
        try {
            logService.debug('Getting stores from config...');
            // Używamy danych z stores.js
            return stores;
        } catch (error) {
            logService.error('Failed to get stores', error);
            throw error;
        }
    }

    calculateStatusCounts(orders) {
        const counts = {
            submitted: 0,
            confirmed: 0,
            accepted: 0,
            ready: 0
        };

        if (!Array.isArray(orders)) return counts;

        orders.forEach(order => {
            if (!order?.status) return;
            
            switch (order.status.toLowerCase()) {
                case 'submitted':
                    counts.submitted++;
                    break;
                case 'confirmed':
                    counts.confirmed++;
                    break;
                case 'accepted':
                    counts.accepted++;
                    break;
                case 'ready':
                    counts.ready++;
                    break;
            }
        });

        return counts;
    }
}

// Create and export singleton instance
export const darwinaService = new DarwinaService(); 