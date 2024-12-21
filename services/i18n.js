/**
 * Serwis do obsługi tłumaczeń
 */
class I18nService {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'polish';
        this.initialized = false;
        this.supportedLanguages = ['polish', 'english', 'ukrainian'];
        this.fallbackTranslations = {
            "loading": "Ładowanie...",
            "error": "Błąd",
            "retry": "Spróbuj ponownie",
            "close": "Zamknij",
            "allStores": "Wszystkie sklepy"
        };
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Inicjalizuje serwis tłumaczeń
     */
    async init() {
        if (this.initialized) return;
        
        try {
            console.log('Loading translations for:', this.currentLanguage);
            const url = chrome.runtime.getURL(`locales/${this.currentLanguage}.json`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load translations: ${response.status}`);
            }
            this.translations = await response.json();
            
            // Załaduj zapisany język
            const savedLang = localStorage.getItem('language');
            if (savedLang && this.supportedLanguages.includes(savedLang)) {
                await this.setLanguage(savedLang);
            }
            this.initialized = true;
            console.log('i18n initialized successfully');
        } catch (error) {
            console.error('Failed to initialize translations:', error);
            // Użyj fallback translations w przypadku błędu
            this.translations = this.fallbackTranslations;
            this.initialized = true; // Pozwól aplikacji działać z podstawowymi tłumaczeniami
            console.warn('Using fallback translations');
        }
    }

    /**
     * Zmienia język
     * @param {string} lang - Kod języka
     */
    async setLanguage(lang) {
        try {
            if (!this.supportedLanguages.includes(lang)) {
                throw new Error(`Unsupported language: ${lang}`);
            }
            console.log('Switching language to:', lang);
            const url = chrome.runtime.getURL(`locales/${lang}.json`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load language ${lang}: ${response.status}`);
            }
            this.translations = await response.json();
            this.currentLanguage = lang;
            localStorage.setItem('language', lang);
            this.updateDataI18n();
            console.log('Language switched successfully');
        } catch (error) {
            console.error(`Failed to load language ${lang}:`, error);
            // Nie zmieniamy języka w przypadku błędu
            throw error;
        }
    }

    /**
     * Pobiera tłumaczenie
     * @param {string} key - Klucz tłumaczenia
     */
    translate(key) {
        try {
            let translation = key.split('.').reduce((obj, k) => {
                if (obj === undefined) return undefined;
                return obj[k];
            }, this.translations);
            
            if (translation === undefined) {
                console.warn(`Missing translation for key: ${key}`);
                // Spróbuj użyć fallback translations
                translation = key.split('.').reduce((obj, k) => obj?.[k], this.fallbackTranslations);
                return translation || key;
            }
            
            return translation;
        } catch (error) {
            console.error(`Translation error for key ${key}:`, error);
            return key;
        }
    }

    /**
     * Aktualizuje tłumaczenia w DOM
     */
    updateDataI18n() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translate(key);
        });

        document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
            const key = element.getAttribute('data-i18n-tooltip');
            element.title = this.translate(key);
        });
    }
}

// Singleton instance
export const i18n = new I18nService(); 