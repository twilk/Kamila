import { transition } from './Transition.js';

/**
 * Komponent do obsługi powiadomień
 */
export class Notification {
    constructor(options = {}) {
        this.container = this.createContainer();
        this.queue = [];
        this.active = null;
        this.duration = options.duration || 3000;
        this.maxVisible = options.maxVisible || 1;
        this.timeouts = new Set();
    }

    /**
     * Tworzy kontener dla powiadomień
     * @returns {HTMLElement} Element kontenera
     */
    createContainer() {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        container.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
        return container;
    }

    /**
     * Tworzy element powiadomienia
     * @param {Object} options Opcje powiadomienia
     * @returns {HTMLElement} Element powiadomienia
     */
    createNotificationElement(options) {
        const element = document.createElement('div');
        element.className = `notification notification-${options.type || 'info'}`;
        element.style.cssText = `
            margin-bottom: 8px;
            padding: 12px 16px;
            border-radius: 4px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            min-width: 240px;
            max-width: 480px;
            transform: translateZ(0);
        `;

        // Ikona
        if (options.icon) {
            const icon = document.createElement('span');
            icon.className = 'notification-icon';
            icon.innerHTML = options.icon;
            icon.style.marginRight = '12px';
            element.appendChild(icon);
        }

        // Treść
        const content = document.createElement('div');
        content.className = 'notification-content';
        content.style.flex = '1';

        if (options.title) {
            const title = document.createElement('div');
            title.className = 'notification-title';
            title.textContent = options.title;
            title.style.fontWeight = 'bold';
            content.appendChild(title);
        }

        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = options.message;
        content.appendChild(message);

        element.appendChild(content);

        // Przycisk zamknięcia
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close btn-hover';
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 4px 8px;
            margin-left: 8px;
            opacity: 0.5;
            transition: opacity 0.2s;
        `;
        closeButton.addEventListener('mouseover', () => closeButton.style.opacity = '1');
        closeButton.addEventListener('mouseout', () => closeButton.style.opacity = '0.5');
        closeButton.addEventListener('click', () => this.close(element));
        element.appendChild(closeButton);

        return element;
    }

    /**
     * Pokazuje powiadomienie
     * @param {Object} options Opcje powiadomienia
     * @returns {Promise} Promise kończący się po zamknięciu powiadomienia
     */
    async show(options) {
        const element = this.createNotificationElement(options);
        this.queue.push({ element, options });
        this.processQueue();
    }

    /**
     * Przetwarza kolejkę powiadomień
     */
    async processQueue() {
        if (this.active || this.queue.length === 0) return;

        const { element, options } = this.queue.shift();
        this.active = element;

        this.container.appendChild(element);
        await transition.enter(element);

        // Automatyczne zamknięcie po określonym czasie
        if (options.duration !== 0) {
            const timeout = setTimeout(() => {
                this.close(element);
                this.timeouts.delete(timeout);
            }, options.duration || this.duration);
            this.timeouts.add(timeout);
        }
    }

    /**
     * Zamyka powiadomienie
     * @param {HTMLElement} element Element powiadomienia
     */
    async close(element) {
        await transition.leave(element);
        element.remove();
        this.active = null;
        this.processQueue();
    }

    cleanup() {
        // Clear all timeouts
        for (const timeout of this.timeouts) {
            clearTimeout(timeout);
        }
        this.timeouts.clear();

        // Remove all notifications
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        
        // Clear queue
        this.queue = [];
        this.active = null;

        // Remove container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    /**
     * Pokazuje powiadomienie o sukcesie
     * @param {string} message Treść powiadomienia
     * @param {Object} options Dodatkowe opcje
     */
    success(message, options = {}) {
        return this.show({
            type: 'success',
            icon: '✅',
            message,
            ...options
        });
    }

    /**
     * Pokazuje powiadomienie o błędzie
     * @param {string} message Treść powiadomienia
     * @param {Object} options Dodatkowe opcje
     */
    error(message, options = {}) {
        return this.show({
            type: 'error',
            icon: '❌',
            message,
            ...options
        });
    }

    /**
     * Pokazuje powiadomienie informacyjne
     * @param {string} message Treść powiadomienia
     * @param {Object} options Dodatkowe opcje
     */
    info(message, options = {}) {
        return this.show({
            type: 'info',
            icon: 'ℹ️',
            message,
            ...options
        });
    }

    /**
     * Pokazuje powiadomienie ostrzegawcze
     * @param {string} message Treść powiadomienia
     * @param {Object} options Dodatkowe opcje
     */
    warning(message, options = {}) {
        return this.show({
            type: 'warning',
            icon: '⚠️',
            message,
            ...options
        });
    }

    /**
     * Tworzy nową instancję z domyślnymi opcjami
     * @param {Object} options Opcje konfiguracyjne
     * @returns {Notification} Nowa instancja komponentu
     */
    static create(options = {}) {
        return new Notification(options);
    }
}

// Eksportuj domyślną instancję
export const notification = new Notification(); 