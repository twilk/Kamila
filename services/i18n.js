import { sendLogToPopup } from '../config/api.js';

const LANGUAGE_FILES = {
    'pl': 'polish',
    'en': 'english',
    'ua': 'ukrainian'
};

export const i18n = {
    translations: {},
    currentLanguage: 'polish',

    async init() {
        try {
            // Pobierz zapisany język lub użyj domyślnego
            this.currentLanguage = localStorage.getItem('language') || 'polish';
            
            const fileName = LANGUAGE_FILES[this.currentLanguage] || this.currentLanguage;
            const response = await fetch(chrome.runtime.getURL(`locales/${fileName}.json`));
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${this.currentLanguage}`);
            }
            this.translations = await response.json();
            sendLogToPopup('🌍 Loaded translations:', 'info', {
                language: this.currentLanguage,
                entriesCount: Object.keys(this.translations).length
            });
        } catch (error) {
            console.error('Error loading translations:', error);
            sendLogToPopup('❌ Error loading translations', 'error', error.message);
            // Fallback do pustego obiektu tłumaczeń
            this.translations = {};
        }
    },

    async setLanguage(lang) {
        try {
            this.currentLanguage = lang;
            localStorage.setItem('language', lang);
            await this.init();
            return true;
        } catch (error) {
            sendLogToPopup('❌ Language change error', 'error', error.message);
            return false;
        }
    },

    translate(key) {
        return key.split('.').reduce((obj, i) => obj?.[i], this.translations) || key;
    },

    updateDataI18n() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);
            if (translation !== key) {
                element.textContent = translation;
            }
        });
    }
}; 