import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * @extends {BaseManager}
 * Manages language settings and translations
 */
export class LanguageManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!LanguageManager._instance) {
            LanguageManager._instance = new LanguageManager();
        }
        return LanguageManager._instance;
    }

    constructor() {
        super('LanguageManager');
        if (LanguageManager._instance) {
            throw new Error('Use LanguageManager.getInstance()');
        }
        this._currentLanguage = 'polish';
        this._translations = {};
        this._supportedLanguages = ['polish', 'english', 'ukrainian'];
    }

    /**
     * Initialize language manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            await super.initialize();
            await this._loadLanguagePreference();
            await this._loadTranslations();
            this._setupEventListeners();
            this._updateUI();
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
    async _loadLanguagePreference() {
        try {
            const { language } = await chrome.storage.local.get('language');
            if (language && this._supportedLanguages.includes(language)) {
                this._currentLanguage = language;
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '_loadLanguagePreference'
            });
        }
    }

    /**
     * Load translations for current language
     * @private
     */
    async _loadTranslations() {
        try {
            const response = await fetch(chrome.runtime.getURL(`locales/${this._currentLanguage}.json`));
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${this._currentLanguage}`);
            }
            this._translations = await response.json();
        } catch (error) {
            this.handleError(error, ErrorType.RESOURCE, ErrorSeverity.HIGH, {
                method: '_loadTranslations',
                language: this._currentLanguage
            });
        }
    }

    /**
     * Set up language switcher event listeners
     * @private
     */
    _setupEventListeners() {
        document.querySelectorAll('#language-switcher .flag').forEach(flag => {
            flag.addEventListener('click', (e) => this._handleLanguageChange(e));
        });
    }

    /**
     * Handle language change event
     * @private
     * @param {Event} event Click event
     */
    async _handleLanguageChange(event) {
        try {
            const newLanguage = event.currentTarget.dataset.lang;
            if (this._supportedLanguages.includes(newLanguage)) {
                await this.setLanguage(newLanguage);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_handleLanguageChange'
            });
        }
    }

    /**
     * Update UI language indicators
     * @private
     */
    _updateUI() {
        try {
            // Update language switcher
            document.querySelectorAll('#language-switcher .flag').forEach(flag => {
                flag.classList.toggle('active', flag.dataset.lang === this._currentLanguage);
            });

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
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_updateUI'
            });
        }
    }

    /**
     * Set current language
     * @param {string} language Language code
     */
    async setLanguage(language) {
        try {
            if (!this._supportedLanguages.includes(language)) {
                throw new Error(`Unsupported language: ${language}`);
            }

            this._currentLanguage = language;
            await chrome.storage.local.set({ language });
            await this._loadTranslations();
            this._updateUI();

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
        return this._currentLanguage;
    }

    /**
     * Get supported languages
     * @returns {string[]} List of supported language codes
     */
    getSupportedLanguages() {
        return [...this._supportedLanguages];
    }

    /**
     * Translate a key
     * @param {string} key Translation key
     * @param {Object} [params] Translation parameters
     * @returns {string} Translated text
     */
    translate(key, params = {}) {
        try {
            let text = this._translations[key]?.message || key;

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
            document.querySelectorAll('#language-switcher .flag').forEach(flag => {
                flag.removeEventListener('click', this._handleLanguageChange);
            });
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