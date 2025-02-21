import { BaseManager } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';

class OrderService extends BaseManager {
    #credentials = null;
    static #instance = null;
    static _registry = null;

    constructor(registry) {
        if (OrderService.#instance) {
            return OrderService.#instance;
        }
        super(registry, 'OrderService');
        OrderService.#instance = this;
        OrderService._registry = registry;
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

    async initialize() {
        try {
            await this.#loadCredentials();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Load credentials from config file
     * @private
     */
    async #loadCredentials() {
        try {
            const response = await fetch('/config/credentials.json');
            if (!response.ok) {
                throw new Error(`Failed to load credentials: ${response.statusText}`);
            }
            const credentials = await response.json();
            if (!credentials?.client_id || !credentials?.client_secret) {
                throw new Error('Invalid credentials format');
            }
            this.#credentials = credentials;
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'loadCredentials'
            });
            throw error;
        }
    }

    getCredentials() {
        return this.#credentials;
    }

    setCredentials(credentials) {
        if (!credentials?.client_id || !credentials?.client_secret) {
            throw new Error('Invalid credentials format');
        }
        this.#credentials = credentials;
    }
}

// Export both class and instance
export { OrderService };
export const orderService = OrderService.getInstance(); 