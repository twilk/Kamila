import { logService } from './LogService.js';
import { 
    LANGUAGES, 
    DEFAULT_LANGUAGE, 
    AVAILABLE_LANGUAGES, 
    isValidLanguage 
} from './constants/languages.js';

export class I18nService {
    constructor() {
        this.translations = {};
        this.currentLanguage = DEFAULT_LANGUAGE;
        this.defaultLanguage = DEFAULT_LANGUAGE;
        this.initialized = false;
        logService.info('I18nService constructed');
    }

    async initialize() {
        try {
            await this.loadTranslations();
            await this.loadStoredLanguage();
            this.initialized = true;
            logService.info('I18nService initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize I18nService:', error);
            this.initialized = false;
        }
    }

    async loadTranslations() {
        try {
            logService.debug('Loading translations...');
            
            // Map of languages to file names
            const languageFiles = AVAILABLE_LANGUAGES.reduce((acc, lang) => {
                acc[lang] = `${lang}.json`;
                return acc;
            }, {});

            // Load all translation files
            const translations = await Promise.all(
                Object.entries(languageFiles).map(async ([code, file]) => {
                    const response = await fetch(`/locales/${file}`);
                    if (!response.ok) {
                        throw new Error(`Failed to load ${file}: ${response.status} ${response.statusText}`);
                    }
                    const data = await response.json();
                    return [code, data];
                })
            );

            // Cache translations with proper language codes
            this.translations = Object.fromEntries(translations);

            logService.debug('Translations loaded:', Object.keys(this.translations));
            logService.info('Translations loaded and cached successfully');
        } catch (error) {
            logService.error('Failed to load translations:', error);
            // Initialize with empty translations to prevent null reference errors
            this.translations = AVAILABLE_LANGUAGES.reduce((acc, lang) => {
                acc[lang] = {};
                return acc;
            }, {});
            throw error;
        }
    }

    async loadStoredLanguage() {
        try {
            const result = await chrome.storage.local.get('language');
            if (result.language && isValidLanguage(result.language)) {
                this.currentLanguage = result.language;
                logService.debug('Loaded stored language:', this.currentLanguage);
            } else {
                this.currentLanguage = this.defaultLanguage;
                await chrome.storage.local.set({ language: this.defaultLanguage });
                logService.debug('Set default language:', this.defaultLanguage);
            }
        } catch (error) {
            logService.error('Error loading stored language:', error);
            this.currentLanguage = this.defaultLanguage;
        }
    }

    async setLanguage(language) {
        try {
            logService.debug('Setting language:', {
                requested: language,
                current: this.currentLanguage,
                available: AVAILABLE_LANGUAGES
            });

            // Validate language
            if (!isValidLanguage(language)) {
                logService.error(`Invalid language requested: ${language}`);
                throw new Error(`Invalid language: ${language}. Available languages: ${AVAILABLE_LANGUAGES.join(', ')}`);
            }

            // Check if translations are loaded
            if (!this.translations[language] || Object.keys(this.translations[language]).length === 0) {
                logService.warn(`Empty translations for ${language}, attempting to reload`);
                await this.loadTranslations();
                
                if (!this.translations[language] || Object.keys(this.translations[language]).length === 0) {
                    logService.error(`Failed to load translations for ${language}`);
                    throw new Error(`Failed to load translations for ${language}`);
                }
            }

            // Set new language
            const previousLanguage = this.currentLanguage;
            this.currentLanguage = language;

            // Save to storage
            try {
                await chrome.storage.local.set({ language });
                logService.info('Language changed successfully', {
                    from: previousLanguage,
                    to: language
                });
                return true;
            } catch (storageError) {
                // Rollback on storage error
                this.currentLanguage = previousLanguage;
                logService.error('Failed to save language preference:', storageError);
                throw new Error(`Failed to save language preference: ${storageError.message}`);
            }
        } catch (error) {
            logService.error('Error setting language:', {
                error: error.message,
                language,
                current: this.currentLanguage,
                available: AVAILABLE_LANGUAGES
            });
            return false;
        }
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    translate(key) {
        try {
            if (!key) {
                logService.warn('Empty translation key provided');
                return '';
            }

            const currentTranslations = this.translations[this.currentLanguage];
            if (!currentTranslations) {
                logService.warn(`No translations found for language: ${this.currentLanguage}`);
                // Try fallback to default language
                const defaultTranslations = this.translations[this.defaultLanguage];
                if (!defaultTranslations) {
                    logService.error('No translations found for default language');
                    return key;
                }
                return this.translateWithFallback(key, defaultTranslations);
            }

            return this.translateWithFallback(key, currentTranslations);
        } catch (error) {
            logService.error('Translation error:', error);
            return key;
        }
    }

    translateWithFallback(key, translations) {
        const keys = key.split('.');
        let result = translations;

        for (const k of keys) {
            if (!result || typeof result !== 'object') {
                logService.warn(`Translation path broken at key: ${k} in ${key}`);
                return key;
            }
            result = result[k];
        }

        if (result === undefined || result === null) {
            logService.warn(`Translation missing for key: ${key}`);
            return key;
        }

        return result;
    }

    cleanup() {
        this.translations = {};
        this.currentLanguage = DEFAULT_LANGUAGE;
        this.initialized = false;
    }
}

export const i18nService = new I18nService(); 