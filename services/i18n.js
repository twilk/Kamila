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
            const { language } = await chrome.storage.local.get('language');
            this.currentLanguage = language || 'polish';
            await this.loadTranslations();
            return true;
        } catch (error) {
            this.translations = {};
            return false;
        }
    },

    async loadTranslations() {
        const fileName = LANGUAGE_FILES[this.currentLanguage];
        if (!fileName) {
            throw new Error(`Nieobsługiwany język: ${this.currentLanguage}`);
        }

        const response = await fetch(chrome.runtime.getURL(`locales/${fileName}.json`));
        if (!response.ok) {
            throw new Error(`Błąd ładowania tłumaczeń: ${response.status}`);
        }

        this.translations = await response.json();
    },

    async setLanguage(lang) {
        const normalizedLang = {
            'pl': 'polish',
            'en': 'english',
            'ua': 'ukrainian'
        }[lang] || lang;

        if (!LANGUAGE_FILES[normalizedLang]) {
            throw new Error(`Nieobsługiwany język: ${lang}`);
        }

        this.currentLanguage = normalizedLang;
        await this.loadTranslations();
        this.updateDataI18n();
        this.updateTooltips();
    },

    translate(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.translations) || key;
    },

    updateDataI18n() {
        // Najpierw menu - zapobiega migotaniu
        document.querySelectorAll('.link-title').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                const translation = this.translate(key);
                if (translation) {
                    const textElement = element.querySelector('.menu-text');
                    if (textElement) {
                        textElement.textContent = translation;
                    }
                }
            }
        });

        // Pozostałe elementy
        document.querySelectorAll('[data-i18n]:not(.link-title)').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);
            if (translation) {
                element.textContent = translation;
            }
        });
    },

    updateTooltips() {
        document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
            const key = element.getAttribute('data-i18n-tooltip');
            const translation = this.translate(key);
            if (translation) {
                element.title = translation;
            }
        });
    }
}; 