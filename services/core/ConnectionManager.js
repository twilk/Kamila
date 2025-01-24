import { BaseManager } from './BaseManager.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { eventManager } from './EventManager.js';
import { environment } from './environment.js';
import { API_CONFIG } from '../../config/api.js';

/**
 * Manages API connections and requests
 * @extends BaseManager
 */
export class ConnectionManager extends BaseManager {
    static _instance = null;
    #connectionStatus = false;
    #checkInterval = null;
    #retryTimeout = null;
    #headers = {
        'Content-Type': 'application/json'
    };

    constructor() {
        if (ConnectionManager._instance) {
            throw new Error('Use ConnectionManager.getInstance()');
        }
        super('ConnectionManager');
        ConnectionManager._instance = this;
        
        // Add EventManager dependency
        this.addDependency(eventManager);
    }

    /**
     * Get singleton instance
     * @returns {ConnectionManager}
     */
    static getInstance() {
        if (!ConnectionManager._instance) {
            ConnectionManager._instance = new ConnectionManager();
        }
        return ConnectionManager._instance;
    }

    /**
     * Initialize connection manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing connection manager...');
            
            // Get EventManager instance
            const eventManager = this.getDependency('EventManager');
            if (!eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }

            // In development mode, we can initialize without connection
            if (environment.isDevelopment) {
                this.log(LogLevel.INFO, '🔧 Development mode - skipping connection check');
                this.#connectionStatus = true;
                return true;
            }

            // Initial connection check
            await this.#checkConnection();
            
            // Start periodic checks only in production
            if (!environment.isDevelopment) {
                this.#startConnectionCheck();
            }
            
            this.log(LogLevel.SUCCESS, '✅ Connection manager initialized');
            return true;
        } catch (error) {
            // In development mode, we can continue even if connection fails
            if (environment.isDevelopment) {
                this.log(LogLevel.WARNING, '⚠️ Connection check failed in development mode - continuing anyway');
                this.#connectionStatus = true;
                return true;
            }

            this.handleError(error, ErrorType.NETWORK, ErrorSeverity.HIGH, {
                method: 'onInitialize'
            });
            return false;
        }
    }

    /**
     * Start connection check interval
     * @private
     */
    #startConnectionCheck() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
        }

        // Check connection every 30 seconds
        this.#checkInterval = setInterval(() => {
            // Skip checks in development mode
            if (environment.isDevelopment) return;

            this.#checkConnection().catch(error => {
                this.handleError(error, ErrorType.NETWORK, ErrorSeverity.MEDIUM, {
                    method: '_startConnectionCheck'
                });
            });
        }, 30000);
    }

    /**
     * Check connection status using access token endpoint
     * @private
     */
    async #checkConnection() {
        try {
            // In development mode, always return success
            if (environment.isDevelopment) {
                this.#connectionStatus = true;
                return;
            }

            const response = await fetch(`${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.AUTH}`, {
                method: 'HEAD',
                headers: this.#headers
            });

            const wasConnected = this.#connectionStatus;
            this.#connectionStatus = response.ok;

            const eventManager = this.getDependency('EventManager');
            if (!wasConnected && response.ok) {
                this.log(LogLevel.SUCCESS, '🔄 Connection restored');
                eventManager.emit('connection-restored');
            } else if (wasConnected && !response.ok) {
                this.log(LogLevel.ERROR, '❌ Connection lost');
                eventManager.emit('connection-lost');
            }
        } catch (error) {
            // In development mode, ignore connection errors
            if (environment.isDevelopment) {
                this.#connectionStatus = true;
                return;
            }

            this.#connectionStatus = false;
            this.handleError(error, ErrorType.NETWORK, ErrorSeverity.MEDIUM, {
                method: '_checkConnection'
            });
            const eventManager = this.getDependency('EventManager');
            eventManager.emit('connection-error', error);
        }
    }

    /**
     * Get current connection status
     * @returns {boolean}
     */
    isConnected() {
        // In development mode, always return true
        if (environment.isDevelopment) {
            return true;
        }
        return this.#connectionStatus;
    }

    /**
     * Get headers
     * @returns {Object}
     */
    getHeaders() {
        return { ...this.#headers };
    }

    /**
     * Clean up resources
     */
    async dispose() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
            this.#checkInterval = null;
        }

        if (this.#retryTimeout) {
            clearTimeout(this.#retryTimeout);
            this.#retryTimeout = null;
        }

        this.#connectionStatus = false;
        await super.dispose();
    }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance(); 