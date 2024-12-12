import { sendLogToPopup } from '../config/api.js';

async function loadTranslations(lang) {
    const response = await fetch(`locales/${lang}.json`);
    if (!response.ok) {
        throw new Error(`Failed to load translations for ${lang}`);
    }
    return await response.json();
}

export const i18n = {
    currentLanguage: 'polish',
    translations: null,

    async init() {
        try {
            const savedLanguage = localStorage.getItem('language') || 'polish';
            const response = await fetch(`locales/${savedLanguage}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${savedLanguage}`);
            }
            this.translations = await response.json();
            this.currentLanguage = savedLanguage;
            
            if (!this.validateTranslations(this.translations)) {
                throw new Error('Invalid translations format');
            }
            
            sendLogToPopup('🌍 Translations loaded', 'success');
            return this.translations;
        } catch (error) {
            sendLogToPopup('❌ Failed to load translations', 'error', error.message);
            // Próba załadowania języka polskiego jako fallback
            try {
                const response = await fetch('locales/polish.json');
                if (!response.ok) {
                    throw new Error('Failed to load fallback translations');
                }
                this.translations = await response.json();
                this.currentLanguage = 'polish';
                if (!this.validateTranslations(this.translations)) {
                    throw new Error('Invalid fallback translations format');
                }
                sendLogToPopup('🌍 Fallback translations loaded', 'success');
                return this.translations;
            } catch (fallbackError) {
                console.error('Fallback translation loading error:', fallbackError);
                this.translations = {};
                throw error;
            }
        }
    },

    validateTranslations(translations) {
        if (!translations || typeof translations !== 'object') {
            console.error('Invalid translations object');
            return false;
        }

        // Lista wymaganych kluczy
        const requiredKeys = [
            'welcome', 'chat', 'settings', 'about', 'status',
            'queryLabel', 'queryPlaceholder', 'send',
            'theme', 'themeLight', 'themeDark',
            'background', 'defaultBackground', 'addCustomWallpaper', 'wallpaperRequirements',
            'debugMode', 'creator', 'purpose', 'version',
            'checkUpdates', 'instructions', 'serviceStatus',
            'apiSelly', 'authorization', 'orders', 'cache',
            'workingProperly', 'hasIssues', 'notWorking',
            'runTests', 'refreshStatus', 'logs', 'clear',
            'leadDetails', 'cancel', 'update', 'loading',
            'errorEmptyQuery', 'errorConnection',
            'debugPanelTitle', 'debugPanelEmpty', 'debugPanelError',
            'debugPanelSuccess', 'debugPanelInfo', 'debugPanelWarn',
            'appTitle', 'debugTitle', 'updateVersionInfo',
            'leadStatuses', 'languagePolish', 'languageEnglish', 'languageUkrainian',
            'instructionUnzip', 'instructionGoTo', 'instructionRemove',
            'instructionDevMode', 'instructionLoad', 'instructionSelect',
            'instructionsTitle', 'modalUpdateNotes', 'modalUpdateConfirm',
            'modalUpdateSuccess', 'modalUpdateError', 'updateAvailable'
        ];

        // Sprawdź czy wszystkie wymagane klucze istnieją
        const missingKeys = requiredKeys.filter(key => !(key in translations));
        if (missingKeys.length > 0) {
            console.error('Missing required translation keys:', missingKeys);
            return false;
        }

        // Sprawdź czy leadStatuses ma wszystkie wymagane podklucze
        if (!translations.leadStatuses || typeof translations.leadStatuses !== 'object') {
            console.error('Missing or invalid leadStatuses object');
            return false;
        }

        const requiredStatusKeys = ['submitted', 'confirmed', 'accepted', 'ready', 'overdue'];
        const missingStatusKeys = requiredStatusKeys.filter(key => !(key in translations.leadStatuses));
        if (missingStatusKeys.length > 0) {
            console.error('Missing required leadStatuses keys:', missingStatusKeys);
            return false;
        }

        // Sprawdź czy wszystkie wartości w leadStatuses są stringami
        const invalidStatusValues = Object.entries(translations.leadStatuses)
            .filter(([key, value]) => typeof value !== 'string')
            .map(([key]) => key);

        if (invalidStatusValues.length > 0) {
            console.error('Invalid value types in leadStatuses for keys:', invalidStatusValues);
            return false;
        }

        // Sprawdź czy wszystkie wartości są stringami lub obiektami (dla zagnieżdżonych tłumaczeń)
        const invalidValues = Object.entries(translations)
            .filter(([key, value]) => {
                if (key === 'leadStatuses') {
                    return typeof value !== 'object' || value === null;
                }
                return typeof value !== 'string' && (typeof value !== 'object' || value === null);
            })
            .map(([key]) => key);

        if (invalidValues.length > 0) {
            console.error('Invalid value types for keys:', invalidValues);
            return false;
        }

        // Sprawdź czy nie ma pustych stringów w tłumaczeniach
        const emptyValues = Object.entries(translations)
            .filter(([key, value]) => {
                if (key === 'leadStatuses') return false;
                return typeof value === 'string' && value.trim() === '';
            })
            .map(([key]) => key);

        if (emptyValues.length > 0) {
            console.error('Empty string values for keys:', emptyValues);
            return false;
        }

        return true;
    },

    translate(key) {
        if (!key) {
            console.warn('Translation key is undefined');
            return '';
        }

        if (!this.translations) {
            console.warn('Translations not loaded yet');
            return key;
        }

        try {
            const keys = String(key).split('.');
            let value = this.translations;
            
            for (const k of keys) {
                if (!value || typeof value !== 'object') {
                    console.warn(`Invalid translation path for key: ${key}`);
                    return key;
                }
                value = value[k];
            }
            
            if (value === undefined || value === null) {
                console.warn(`Missing translation for key: ${key}`);
                return key;
            }

            return value;
        } catch (error) {
            console.error('Translation error:', error);
            return key;
        }
    },

    updateFlags(currentLang) {
        document.querySelectorAll('.flag').forEach(flag => {
            flag.classList.toggle('active', flag.dataset.lang === currentLang);
        });
    },

    updateDataI18n() {
        if (!this.translations) {
            console.warn('Translations not loaded yet, skipping DOM update');
            return;
        }

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translate(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.translate(key);
        });

        document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
            const key = element.getAttribute('data-i18n-tooltip');
            element.title = this.translate(key);
        });
    }
}; 