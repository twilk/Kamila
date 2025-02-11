import { sendLogToPopup } from '../config/api.js';

const LANGUAGE_FILES = {
    'polish': 'polish',
    'english': 'english',
    'ukrainian': 'ukrainian'
};

export const i18n = {
    translations: {},
    currentLanguage: 'polish',

    async init() {
        try {
            // Pobierz zapisany język lub użyj domyślnego
            const savedLang = localStorage.getItem('language');
            this.currentLanguage = savedLang || 'polish';
            
            const fileName = LANGUAGE_FILES[this.currentLanguage];
            if (!fileName) {
                throw new Error(`Nieobsługiwany język: ${this.currentLanguage}`);
            }

            const response = await fetch(chrome.runtime.getURL(`locales/${fileName}.json`));
            if (!response.ok) {
                throw new Error(`Błąd ładowania tłumaczeń: ${response.status}`);
            }

            this.translations = await response.json();
            return true;
        } catch (error) {
            console.error('Error loading translations:', error);
            // Fallback do pustego obiektu tłumaczeń
            this.translations = {};
            return false;
        }
    },

    translate(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.translations) || key;
    },

    updateDataI18n() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);
            if (translation) {
                element.textContent = translation;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.translate(key);
            if (translation) {
                element.placeholder = translation;
            }
        });
    }
}; 