import { BaseManager } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import credentials from '../../config/credentials.json' assert { type: 'json' };

export class OrderService extends BaseManager {
    #credentials = null;

    constructor() {
        super('OrderService');
        this.#validateAndSetCredentials();
    }

    /**
     * Load credentials from config file
     * @private
     * @returns {Promise<{client_id: string, client_secret: string}>}
     */
    async #loadCredentials() {
        try {
            const response = await fetch(chrome.runtime.getURL('config/credentials.json'));
            if (!response.ok) {
                throw new Error(`Failed to load credentials: ${response.statusText}`);
            }
            const credentials = await response.json();
            return credentials;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'loadCredentials'
            });
            throw error;
        }
    }

    /**
     * Validate and set credentials
     * @private
     * @param {Object} credentials
     * @throws {Error} If credentials are invalid
     */
    async #validateAndSetCredentials(credentials) {
        try {
            // If credentials provided directly, validate them
            if (credentials?.username && credentials?.password) {
                this.#credentials = credentials;
                return true;
            }

            // Try to load from credentials.json
            try {
                const response = await fetch(chrome.runtime.getURL('credentials.json'));
                if (!response.ok) {
                    throw new Error('Failed to load credentials.json');
                }
                const fileCredentials = await response.json();
                
                if (!fileCredentials?.username || !fileCredentials?.password) {
                    throw new Error('Invalid credentials format in credentials.json');
                }

                this.#credentials = fileCredentials;
                return true;
            } catch (error) {
                this.handleError(error, ErrorType.CONFIGURATION, ErrorSeverity.HIGH, {
                    method: 'validateAndSetCredentials',
                    source: 'credentials.json'
                });
                return false;
            }
        } catch (error) {
            this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.HIGH, {
                method: 'validateAndSetCredentials'
            });
            return false;
        }
    }
}

// Export singleton instance
export const orderService = new OrderService(); 