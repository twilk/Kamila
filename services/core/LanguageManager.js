import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { EventType } from './EventType.js';
import { LANGUAGE_CONFIG } from '../../config/language.js';

/**
 * @extends {BaseManager}
 * Manages language settings and translations
 */
class LanguageManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #settings;

    /** @private */

    #currentLanguage = 'polish';
    #translations = {};
    #supportedLanguages = ['polish', 'english', 'ukrainian'];
    #isReady = false;

    constructor(registry) {
        if (LanguageManager.#instance) {
            return LanguageManager.#instance;
        }
        super(registry, 'LanguageManager');
        LanguageManager.#instance = this;
        LanguageManager._registry = registry;
        
        // Add EventManager dependency
        this.addDependency('event');
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
            
            // Load language settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(LANGUAGE_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...LANGUAGE_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ Language manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    isReady() {
        return this.#isReady;
    }

    /**
     * Load saved language preference
     * @private
     */
    async #loadLanguagePreference() {
        try {
            const { language } = await chrome.storage.local.get('language');
            
            // If no language in storage or unsupported, set default
            if (!language || !this.#supportedLanguages.includes(language)) {
                this.#currentLanguage = 'polish';
                await chrome.storage.local.set({ language: this.#currentLanguage });
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
            const url = chrome.runtime.getURL(`locales/${this.#currentLanguage}.json`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${this.#currentLanguage}`);
            }
            
            this.#translations = await response.json();
            this.log(LogLevel.DEBUG, `✅ Loaded translations for ${this.#currentLanguage}`);
        } catch (error) {
            this.handleError(error, ErrorType.RESOURCE, ErrorSeverity.HIGH, {
                method: '_loadTranslations',
                language: this.#currentLanguage
            });
            this.#translations = {};
        }
    }

    /**
     * Set up event listeners
     * @private
     */
    async #setupEventListeners() {
        try {
            const eventManager = await this.getDependency('event');
            
            // Listen for language events
            await eventManager.on('language:change', async (event) => {
                const language = event?.detail?.language || event?.language;
                if (language && language !== this.#currentLanguage) {
                    await this.setLanguage(language);
                }
            });

            // Listen for UI update events
            await eventManager.on('ui:ready', this.updateUI.bind(this));
            await eventManager.on('orders:updated', this.updateOrderTranslations.bind(this));
            
            // Load initial language
            await this.#loadLanguagePreference();
            await this.#loadTranslations();
            
            this.log(LogLevel.DEBUG, '🌍 Language event listeners set up');
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH, {
                method: '#setupEventListeners'
            });
            throw error;
        }
    }

    /**
     * Update order-related translations in UI
     * @private
     */
    async updateOrderTranslations() {
        try {
            // Update status labels
            document.querySelectorAll('[data-order-status]').forEach(element => {
                const status = element.dataset.orderStatus;
                const key = `leadStatuses.${status}`;
                element.textContent = this.translate(key);
            });

            // Update notification texts
            document.querySelectorAll('[data-order-notification]').forEach(element => {
                const type = element.dataset.orderNotification;
                const key = `notifications.${type}`;
                element.textContent = this.translate(key);
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateOrderTranslations'
            });
        }
    }

    /**
     * Handle language change event
     * @private
     * @param {Event} event Click event
     */
    async #handleLanguageChange(event) {
        try {
            const newLanguage = event.target.dataset.lang;
            if (this.#supportedLanguages.includes(newLanguage)) {
                await this.setLanguage(newLanguage);
                
                this.log(LogLevel.INFO, `🌍 Language changed to: ${newLanguage}`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'handleLanguageChange'
            });
        }
    }

    /**
     * Update UI language indicators
     */
    async updateUI() {
        try {
            // Update all translatable elements
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.dataset.i18n;
                element.textContent = this.translate(key);
            });

            // Update tooltips
            document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
                const key = element.dataset.i18nTooltip;
                element.title = this.translate(key);
            });

            // Update placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
                const key = element.dataset.i18nPlaceholder;
                element.placeholder = this.translate(key);
            });

            // Update order translations
            await this.updateOrderTranslations();

            // Emit language changed event
            const eventManager = await this.getDependency('event');
            await eventManager.emit(EventType.LANGUAGE_CHANGED, {
                detail: {
                    language: this.#currentLanguage,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateUI'
            });
        }
    }

    /**
     * Set current language
     * @param {string} language Language code
     */
    async setLanguage(language) {
        try {
            if (!this.#supportedLanguages.includes(language)) {
                throw new Error(`Unsupported language: ${language}`);
            }

            this.#currentLanguage = language;
            await chrome.storage.local.set({ language });
            await this.#loadTranslations();
            await this.updateUI();

        } catch (error) {
            this.handleError(error, ErrorType.LANGUAGE, ErrorSeverity.MEDIUM, {
                method: 'setLanguage',
                language
            });
        }
    }

    /**
     * Get current language
     * @returns {string} Current language code
     */
    getCurrentLanguage() {
        return this.#currentLanguage;
    }

    /**
     * Get supported languages
     * @returns {string[]} List of supported language codes
     */
    getSupportedLanguages() {
        return [...this.#supportedLanguages];
    }

    /**
     * Translate a key
     * @param {string} key Translation key
     * @param {Object} [params] Translation parameters
     * @returns {string} Translated text
     */
    translate(key, params = {}) {
        try {
            let text = this.#translations[key]?.message || this.#translations[key] || key;

            // Replace parameters
            Object.entries(params).forEach(([param, value]) => {
                text = text.replace(`{${param}}`, value);
            });

            return text;
        } catch (error) {
            this.handleError(error, ErrorType.LANGUAGE, ErrorSeverity.LOW, {
                method: 'translate',
                key
            });
            return key;
        }
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            const eventManager = this.getDependency('event');
            if (eventManager) {
                eventManager.removeAllDelegates();
            }
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
