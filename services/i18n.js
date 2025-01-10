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
            this.translations = {};
            return false;
        }
    },

    translate(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.translations) || key;
    },

    updateDataI18n() {
        console.log('🔍 Updating i18n data...');
        
        // Najpierw menu - zapobiega migotaniu
        document.querySelectorAll('.link-title').forEach(element => {
            const key = element.getAttribute('data-i18n');
            console.log('📌 Menu element:', element);
            console.log('🔑 Key:', key);
            
            if (key) {
                const translation = this.translate(key);
                console.log('🌐 Translation:', translation);
                
                if (translation) {
                    const textElement = element.querySelector('.menu-text');
                    console.log('📝 Text element:', textElement);
                    
                    if (textElement) {
                        textElement.textContent = translation;
                        console.log('✅ Updated text to:', translation);
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