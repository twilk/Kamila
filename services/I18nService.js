import { logService } from './LogService.js';
import { cacheService } from './CacheService.js';

/**
 * Service for handling internationalization
 */
export class I18nService {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'polish';
        this.fallbackLanguage = 'polish';
        this.initialized = false;
        this.supportedLanguages = ['pl', 'en', 'ua'];
        this.observers = new Set();
        logService.info('I18nService constructed');
    }

    async initialize() {
        if (this.initialized) {
            logService.debug('I18nService already initialized');
            return;
        }

        try {
            logService.info('Initializing I18nService...');
            
            // Try to get cached translations first
            const cachedTranslations = await cacheService.get('translations');
            if (cachedTranslations) {
                this.translations = cachedTranslations;
                logService.debug('Using cached translations');
            } else {
                await this.loadTranslations();
            }

            // Load saved language preference
            const savedLanguage = await cacheService.get('currentLanguage');
            if (savedLanguage && this.supportedLanguages.includes(this.getLangCode(savedLanguage))) {
                this.currentLanguage = savedLanguage;
                logService.debug('Restored language preference', { language: savedLanguage });
            }

            this.initialized = true;
            logService.info('I18nService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize I18nService', error);
            throw error;
        }
    }

    async loadTranslations() {
        try {
            logService.info('Loading translations...');
            const [plTranslations, enTranslations, uaTranslations] = await Promise.all([
                fetch('./locales/polish.json').then(res => res.json()),
                fetch('./locales/english.json').then(res => res.json()),
                fetch('./locales/ukrainian.json').then(res => res.json())
            ]);

            this.translations = {
                pl: plTranslations,
                en: enTranslations,
                ua: uaTranslations
            };

            // Cache the translations
            await cacheService.set('translations', this.translations);
            logService.info('Translations loaded and cached successfully');
        } catch (error) {
            logService.error('Failed to load translations', error);
            throw error;
        }
    }

    translate(key, language = this.currentLanguage) {
        if (!this.initialized) {
            logService.warn('Attempting to translate before initialization');
            return key;
        }

        try {
            const langCode = this.getLangCode(language);
            const translation = this.translations[langCode]?.[key] 
                || this.translations[this.getLangCode(this.fallbackLanguage)]?.[key];
            
            if (!translation) {
                logService.warn(`Missing translation for key: ${key} in language: ${language}`);
                return key;
            }

            return translation;
        } catch (error) {
            logService.error('Translation error', error);
            return key;
        }
    }

    getLangCode(language) {
        const langMap = {
            'polish': 'pl',
            'english': 'en',
            'ukrainian': 'ua'
        };
        return langMap[language] || language;
    }

    async setLanguage(language) {
        if (!this.initialized) {
            throw new Error('Cannot set language before initialization');
        }

        try {
            const langCode = this.getLangCode(language);
            if (!this.supportedLanguages.includes(langCode)) {
                throw new Error(`Unsupported language: ${language}`);
            }

            this.currentLanguage = language;
            await cacheService.set('currentLanguage', language);
            this.notifyObservers();
            logService.info(`Language changed to: ${language}`);
        } catch (error) {
            logService.error('Failed to set language', error);
            throw error;
        }
    }

    addObserver(callback) {
        this.observers.add(callback);
    }

    removeObserver(callback) {
        this.observers.delete(callback);
    }

    notifyObservers() {
        this.observers.forEach(callback => {
            try {
                callback();
            } catch (error) {
                logService.error('Error in i18n observer callback', error);
            }
        });
    }

    updateDataI18n() {
        if (!this.initialized) {
            logService.warn('Attempting to update i18n elements before initialization');
            return;
        }

        try {
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = this.translate(key);
            });
            logService.debug('Updated i18n elements');
        } catch (error) {
            logService.error('Failed to update i18n elements', error);
        }
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getSupportedLanguages() {
        return [...this.supportedLanguages];
    }
}

// Create and export singleton instance
export const i18nService = new I18nService(); 