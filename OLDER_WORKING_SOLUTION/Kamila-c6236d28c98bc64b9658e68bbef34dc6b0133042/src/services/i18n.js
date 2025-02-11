export class I18nService {
    constructor() {
        this.currentLanguage = 'pl';
        this.translations = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            const storedLang = await chrome.storage.local.get('language');
            if (storedLang.language) {
                this.currentLanguage = storedLang.language;
            }
            
            await this.loadTranslations();
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize i18n:', error);
            throw error;
        }
    }

    async loadTranslations() {
        // Load translations from storage or default
        const stored = await chrome.storage.local.get('translations');
        if (stored.translations) {
            this.translations = new Map(Object.entries(stored.translations));
        } else {
            // Default Polish translations
            this.translations.set('pl', {
                // Status messages
                'loading': 'Ładowanie...',
                'error': 'Błąd',
                'success': 'Sukces',
                'warning': 'Ostrzeżenie',
                
                // Lead statuses
                'status_1': 'Nowy',
                'status_2': 'W trakcie',
                'status_3': 'Zakończony',
                'status_ready': 'Gotowy',
                'status_overdue': 'Przeterminowany',
                
                // Actions
                'refresh': 'Odśwież',
                'update': 'Aktualizuj',
                'clear': 'Wyczyść',
                
                // Errors
                'error_loading': 'Błąd ładowania',
                'error_update': 'Błąd aktualizacji',
                'error_connection': 'Błąd połączenia'
            });
        }
    }

    async setLanguage(lang) {
        this.currentLanguage = lang;
        await chrome.storage.local.set({ language: lang });
        await this.loadTranslations();
    }

    translate(key, params = {}) {
        const translations = this.translations.get(this.currentLanguage) || {};
        let text = translations[key] || key;
        
        // Replace parameters in text
        Object.entries(params).forEach(([param, value]) => {
            text = text.replace(`{${param}}`, value);
        });
        
        return text;
    }

    updateDataI18n() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                element.textContent = this.translate(key);
            }
        });
    }
}

export const i18n = new I18nService(); 