import { BaseManager } from './BaseManager.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * @extends {BaseManager}
 * Manages message display and notifications
 */
export class MessageManager extends BaseManager {
    static _instance = null;
    #messageElements = new Map();
    #activeMessages = new Set();
    #messageQueue = [];
    #isProcessing = false;

    constructor() {
        if (MessageManager._instance) {
            throw new Error('Use MessageManager.getInstance()');
        }
        super('MessageManager');
        MessageManager._instance = this;
    }

    /**
     * Get singleton instance
     * @returns {MessageManager}
     */
    static getInstance() {
        if (!MessageManager._instance) {
            MessageManager._instance = new MessageManager();
        }
        return MessageManager._instance;
    }

    /**
     * Initialize message manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            // Initialize message queue
            this.#messageQueue = [];
            this.#isProcessing = false;

            // Set up event listeners
            this.#setupEventListeners();

            this.log(LogLevel.SUCCESS, '💬 Message manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Initialize message elements
     * @private
     */
    #initializeMessageElements() {
        // Find all message elements
        document.querySelectorAll('[data-message-type]').forEach(element => {
            const type = element.dataset.messageType;
            this.#messageElements.set(type, element);
        });
    }

    /**
     * Setup event listeners
     * @private
     */
    #setupEventListeners() {
        // Listen for show message events
        window.addEventListener('ui:message', (event) => {
            const { type, message } = event.detail;
            this.#showMessage(type, message);
        });

        // Listen for hide message events
        window.addEventListener('ui:hideMessage', (event) => {
            const { type } = event.detail;
            this.#hideMessage(type);
        });

        // Listen for hide all messages events
        window.addEventListener('ui:hideAllMessages', () => {
            this.#hideAllMessages();
        });
    }

    /**
     * Show a message
     * @private
     * @param {string} type - Message type
     * @param {string} message - Message content
     */
    #showMessage(type, message) {
        try {
            const element = this.#messageElements.get(type);
            if (!element) {
                throw new Error(`Message element not found for type: ${type}`);
            }

            element.textContent = message;
            element.classList.remove('d-none');
            this.#activeMessages.add(type);

            this.log(LogLevel.DEBUG, `Message shown: ${type}`, { message });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'showMessage',
                type,
                message
            });
        }
    }

    /**
     * Hide a message
     * @private
     * @param {string} type - Message type
     */
    #hideMessage(type) {
        try {
            const element = this.#messageElements.get(type);
            if (element) {
                element.classList.add('d-none');
                this.#activeMessages.delete(type);
                this.log(LogLevel.DEBUG, `Message hidden: ${type}`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'hideMessage',
                type
            });
        }
    }

    /**
     * Hide all messages
     * @private
     */
    #hideAllMessages() {
        try {
            this.#messageElements.forEach((element, type) => {
                element.classList.add('d-none');
                this.#activeMessages.delete(type);
            });
            this.log(LogLevel.DEBUG, 'All messages hidden');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'hideAllMessages'
            });
        }
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            // Hide all messages
            this.#hideAllMessages();

            // Clear collections
            this.#messageElements.clear();
            this.#activeMessages.clear();

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH);
        }
    }
}

// Export singleton instance
export const messageManager = MessageManager.getInstance(); 