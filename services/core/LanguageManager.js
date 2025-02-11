import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { eventManager } from './EventManager.js';
import { EventType } from './EventType.js';

/**
 * @extends {BaseManager}
 * Manages language settings and translations
 */
export class LanguageManager extends BaseManager {
    static #instance = null;
    #currentLanguage = 'polish';
    #translations = {};
    #supportedLanguages = ['polish', 'english', 'ukrainian'];
    #eventManager = null;

    constructor() {
        if (LanguageManager.#instance) {
            return LanguageManager.#instance;
        }
        super('LanguageManager');
        LanguageManager.#instance = this;
        
        // Add EventManager dependency
        this.addDependency(eventManager);
    }

    static getInstance() {
        if (!LanguageManager.#instance) {
            LanguageManager.#instance = new LanguageManager();
        }
        return LanguageManager.#instance;
    }

    /**
     * Initialize language manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            // Get EventManager instance
            this.#eventManager = eventManager;

            await this.#loadLanguagePreference();
            await this.#loadTranslations();
            this.#setupEventListeners();
            await this.updateUI();
            
            this.log(LogLevel.SUCCESS, '✅ Language manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
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
            // Set empty translations to prevent errors
            this.#translations = {};
        }
    }

    /**
     * Set up language switcher event listeners
     * @private
     */
    #setupEventListeners() {
        if (this.#eventManager) {
            // Listen for language change events from other parts of the app
            this.#eventManager.on(EventType.LANGUAGE_CHANGED, async (eventData) => {
                // Handle both event.detail and direct data format
                const language = eventData?.detail?.language || eventData?.language;
                
                if (language && language !== this.#currentLanguage) {
                    await this.setLanguage(language);
                }
            });

            this.log(LogLevel.DEBUG, '🌍 Language event listeners set up');
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

            // Emit language changed event with proper format
            if (this.#eventManager) {
                this.#eventManager.emit(EventType.LANGUAGE_CHANGED, {
                    detail: {
                        language: this.#currentLanguage,
                        timestamp: new Date().toISOString()
                    }
                });
            }
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
            let text = this.#translations[key]?.message || key;

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
            if (this.#eventManager) {
                this.#eventManager.removeAllDelegates();
            }
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const languageManager = LanguageManager.getInstance(); 