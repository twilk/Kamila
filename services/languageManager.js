import { i18n } from './i18n.js';
import { saveToStorage, STORAGE_KEYS } from './storage.js';
import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class LanguageManager extends BaseManager {
    constructor() {
        super();
        this.currentLanguage = 'polish';
    }

    async initialize() {
        try {
            await super.initialize();
            await this.loadLanguage();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async loadLanguage() {
        try {
            const savedLang = await chrome.storage.local.get(STORAGE_KEYS.LANGUAGE);
            const lang = savedLang[STORAGE_KEYS.LANGUAGE] || 'polish';
            
            // Initialize i18n if not already initialized
            if (!i18n.translations || Object.keys(i18n.translations).length === 0) {
                await i18n.init();
            }
            
            if (lang !== this.currentLanguage) {
                await i18n.setLanguage(lang);
                this.currentLanguage = lang;
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'loadLanguage'
            });
        }
    }

    async handleLanguageChange(event) {
        try {
            const lang = event?.target?.value || event?.lang || 'polish';
            
            await i18n.setLanguage(lang);
            this.currentLanguage = i18n.currentLanguage;
            await saveToStorage(STORAGE_KEYS.LANGUAGE, this.currentLanguage);
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'handleLanguageChange',
                language: event?.lang
            });
            return false;
        }
    }

    dispose() {
        try {
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
}

// Export standalone function for backward compatibility
export const handleLanguageChange = LanguageManager.handleLanguageChange; 