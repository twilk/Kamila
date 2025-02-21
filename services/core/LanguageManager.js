import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { EventType } from './EventType.js';
import { LANGUAGE_CONFIG } from '../../config/language.js';

/**
 * @typedef {Object} TranslationConfig
 * @property {string} code - Language code (pl, en, ua)
 * @property {string} name - Display name (polish, english, ukrainian)
 * @property {string} file - JSON file name
 */

const LANGUAGES = {
    polish: { code: 'pl', name: 'polish', file: 'polish.json' },
    english: { code: 'en', name: 'english', file: 'english.json' },
    ukrainian: { code: 'ua', name: 'ukrainian', file: 'ukrainian.json' }
};

/**
 * @extends {BaseManager}
 * Manages language settings and translations
 */
class LanguageManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #currentLanguage = 'polish';
    #translations = {};
    #supportedLanguages = Object.keys(LANGUAGES);
    #isReady = false;
    #eventManager = null;
    #lastUpdate = 0;

    constructor(registry) {
        if (LanguageManager.#instance) {
            return LanguageManager.#instance;
        }
        super(registry, 'LanguageManager');
        LanguageManager.#instance = this;
        LanguageManager._registry = registry;
        
        this.addDependency('event');
        this.addDependency('storage');
    }

    static getInstance() {
        if (!LanguageManager.#instance && LanguageManager._registry) {
            LanguageManager.#instance = new LanguageManager(LanguageManager._registry);
        }
        return LanguageManager.#instance;
    }

    static setRegistry(registry) {
        LanguageManager._registry = registry;
    }

    /**
     * Initialize language manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing language manager...');
            
            // Get required dependencies
            const [eventManager, storage] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('storage')
            ]);

            this.#eventManager = eventManager;

            // Load saved language or use default
            await this.#loadLanguagePreference();
            
            // Load translations
            await this.#loadTranslations();
            
            // Set up event listeners
            await this.#setupEventListeners();
            
            this.#isReady = true;
            
            this.log(LogLevel.SUCCESS, '✅ Language manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Load saved language preference
     * @private
     */
    async #loadLanguagePreference() {
        try {
            const storage = await this.getDependency('storage');
            const { language } = await storage.get('language') || {};
            
            // If no language in storage or unsupported, set default
            if (!language || !this.#supportedLanguages.includes(language)) {
                this.#currentLanguage = 'polish';
                await storage.set('language', { language: this.#currentLanguage });
                this.log(LogLevel.INFO, `Set default language: ${this.#currentLanguage}`);
            } else {
                this.#currentLanguage = language;
                this.log(LogLevel.DEBUG, `Loaded language preference: ${language}`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '_loadLanguagePreference'
            });
            // Fallback to default language
            this.#currentLanguage = 'polish';
        }
    }

    /**
     * Load translations for current language
     * @private
     */
    async #loadTranslations() {
        try {
            const langConfig = LANGUAGES[this.#currentLanguage];
            if (!langConfig) {
                throw new Error(`Invalid language configuration for: ${this.#currentLanguage}`);
            }

            const url = chrome.runtime.getURL(`locales/${langConfig.file}`);
            this.log(LogLevel.DEBUG, `🔄 Loading translations from: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${this.#currentLanguage} (${response.status})`);
            }
            
            const translations = await response.json();
            if (!translations || typeof translations !== 'object') {
                throw new Error(`Invalid translations format for ${this.#currentLanguage}`);
            }

            this.#translations = translations;
            this.#lastUpdate = Date.now();
            
            this.log(LogLevel.SUCCESS, `✅ Loaded translations for ${this.#currentLanguage}`, {
                keysCount: Object.keys(translations).length
            });
            
            // Emit translations loaded event
            if (this.#eventManager?.isInitialized()) {
                await this.#eventManager.emit('language:translations-loaded', {
                    language: this.#currentLanguage,
                    timestamp: this.#lastUpdate,
                    keysCount: Object.keys(translations).length
                });
            }
        } catch (error) {
            this.handleError(error, ErrorType.RESOURCE, ErrorSeverity.HIGH, {
                method: '_loadTranslations',
                language: this.#currentLanguage,
                url: chrome.runtime.getURL(`locales/${LANGUAGES[this.#currentLanguage]?.file}`)
            });
            this.#translations = {};
        }
    }

    /**
     * Check if translations are loaded
     * @returns {boolean}
     */
    hasTranslations() {
        return Object.keys(this.#translations).length > 0;
    }

    /**
     * Wait for translations to load
     * @param {number} timeout Timeout in ms
     * @returns {Promise<boolean>}
     */
    async waitForTranslations(timeout = 5000) {
        const start = Date.now();
        while (!this.hasTranslations() && Date.now() - start < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return this.hasTranslations();
    }

    /**
     * Set up event listeners
     * @private
     */
    async #setupEventListeners() {
        try {
            // Listen for language change events
            await this.#eventManager.on('language:change', async (event) => {
                const language = event?.detail?.language || event?.language;
                if (language && language !== this.#currentLanguage) {
                    await this.setLanguage(language);
                }
            });

            // Listen for UI update events
            await this.#eventManager.on('ui:ready', this.updateUI.bind(this));
            await this.#eventManager.on('orders:updated', this.updateOrderTranslations.bind(this));
            
            // Listen for DOM changes to update new elements
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length) {
                        this.updateUI();
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            this.log(LogLevel.DEBUG, '🌍 Language event listeners set up');
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH, {
                method: '#setupEventListeners'
            });
            throw error;
        }
    }

    /**
     * Update UI with translations
     */
    async updateUI() {
        try {
            // Update text content
            const elements = document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-tooltip], [data-i18n-aria]');
            await Promise.all(Array.from(elements).map(async element => {
                try {
                    if (element.hasAttribute('data-i18n')) {
                        const key = element.dataset.i18n;
                        element.textContent = await this.translate(key);
                    }
                    if (element.hasAttribute('data-i18n-placeholder')) {
                        const key = element.dataset.i18nPlaceholder;
                        element.placeholder = await this.translate(key);
                    }
                    if (element.hasAttribute('data-i18n-tooltip')) {
                        const key = element.dataset.i18nTooltip;
                        element.title = await this.translate(key);
                    }
                    if (element.hasAttribute('data-i18n-aria')) {
                        const key = element.dataset.i18nAria;
                        element.setAttribute('aria-label', await this.translate(key));
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                        method: 'updateUI',
                        element: element.outerHTML
                    });
                }
            }));

            // Update order translations
            await this.updateOrderTranslations();

            // Emit UI updated event
            await this.#eventManager.emit('language:ui-updated', {
                language: this.#currentLanguage,
                timestamp: Date.now()
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateUI'
            });
        }
    }

    /**
     * Update order-related translations
     */
    async updateOrderTranslations() {
        try {
            // Update status labels and notifications in parallel
            const elements = [
                ...document.querySelectorAll('[data-order-status]'),
                ...document.querySelectorAll('[data-order-notification]')
            ];

            await Promise.all(elements.map(async element => {
                try {
                    if (element.hasAttribute('data-order-status')) {
                        const status = element.dataset.orderStatus;
                        const key = `leadStatuses.${status}`;
                        element.textContent = await this.translate(key);
                    } else if (element.hasAttribute('data-order-notification')) {
                        const type = element.dataset.orderNotification;
                        const key = `notifications.${type}`;
                        element.textContent = await this.translate(key);
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                        method: 'updateOrderTranslations',
                        element: element.outerHTML
                    });
                }
            }));
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateOrderTranslations'
            });
        }
    }

    /**
     * Set current language
     * @param {string} language Language name (polish, english, ukrainian)
     */
    async setLanguage(language) {
        try {
            if (!this.#supportedLanguages.includes(language)) {
                throw new Error(`Unsupported language: ${language}`);
            }

            const oldLanguage = this.#currentLanguage;
            this.#currentLanguage = language;

            // Save to storage
            const storage = await this.getDependency('storage');
            await storage.set('language', { language });

            // Load new translations
            await this.#loadTranslations();

            // Update UI
            await this.updateUI();

            // Emit language changed event
            await this.#eventManager.emit('language:changed', {
                oldLanguage,
                newLanguage: language,
                timestamp: Date.now()
            });

            this.log(LogLevel.INFO, `🌍 Language changed from ${oldLanguage} to ${language}`);
        } catch (error) {
            this.handleError(error, ErrorType.LANGUAGE, ErrorSeverity.MEDIUM, {
                method: 'setLanguage',
                language
            });
            throw error;
        }
    }

    /**
     * Get current language
     * @returns {string} Current language name
     */
    getCurrentLanguage() {
        return this.#currentLanguage;
    }

    /**
     * Get supported languages
     * @returns {string[]} List of supported language names
     */
    getSupportedLanguages() {
        return [...this.#supportedLanguages];
    }

    /**
     * Get language code for current language
     * @returns {string} Language code (pl, en, ua)
     */
    getCurrentLanguageCode() {
        return LANGUAGES[this.#currentLanguage]?.code || 'pl';
    }

    /**
     * Translate a key
     * @param {string} key Translation key (dot notation supported)
     * @param {Object} [params] Optional parameters for interpolation
     * @returns {Promise<string>} Translated text
     */
    async translate(key, params = {}) {
        try {
            if (!this.hasTranslations()) {
                await this.waitForTranslations();
            }

            // Get translation using dot notation
            let text = key.split('.').reduce((obj, k) => obj?.[k], this.#translations) || key;

            // Replace parameters
            Object.entries(params).forEach(([param, value]) => {
                text = text.replace(`{${param}}`, value);
            });

            return text;
        } catch (error) {
            this.handleError(error, ErrorType.TRANSLATION, ErrorSeverity.LOW, {
                method: 'translate',
                key,
                params
            });
            return key;
        }
    }

    /**
     * Check if manager is ready
     * @returns {boolean}
     */
    isReady() {
        return this.#isReady;
    }

    /**
     * Get last update timestamp
     * @returns {number}
     */
    getLastUpdate() {
        return this.#lastUpdate;
    }

    /**
     * Clean up resources
     */
    async dispose() {
        try {
            this.#translations = {};
            this.#isReady = false;
            this.#lastUpdate = 0;
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export both class and instance
export { LanguageManager };
export const languageManager = LanguageManager.getInstance(); 
