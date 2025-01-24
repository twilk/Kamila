import { sendLogToPopup } from '../config/api.js';

const LANGUAGE_FILES = {
    'polish': 'polish',
    'english': 'english',
    'ukrainian': 'ukrainian'
};

export const i18n = {
    translations: {},
    currentLanguage: 'polish',
    isInitialized: false,
    translationsLoaded: false,
    loadingPromise: null,

    getCurrentLanguage() {
        return this.currentLanguage;
    },

    async waitForTranslations() {
        if (this.translationsLoaded) return;
        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }
        
        // If no loading in progress, initialize
        if (!this.isInitialized) {
            await this.init();
        }
    },

    async init() {
        console.log('[DEBUG] 🔍 i18n.init() called, isInitialized:', this.isInitialized);
        
        if (this.isInitialized) {
            console.log('[DEBUG] ⚠️ i18n already initialized');
            return;
        }

        try {
            this.loadingPromise = this.loadTranslations(this.currentLanguage);
            await this.loadingPromise;
            this.isInitialized = true;
            this.translationsLoaded = true;
            this.loadingPromise = null;
            
            console.log('[SUCCESS] ✅ i18n initialized:', {
                language: this.currentLanguage,
                keysLoaded: Object.keys(this.translations).length
            });
        } catch (error) {
            console.error('[ERROR] ❌ i18n initialization failed:', error);
            throw error;
        }
    },

    async updateLanguage() {
        // Load translations
        await this.loadTranslations();
        
        // Update UI elements
        this.updateDataI18n();
        this.updateTooltips();
        
        // Update language switcher UI
        document.querySelectorAll('.flag').forEach(flag => {
            flag.classList.toggle('active', flag.dataset.lang === this.currentLanguage);
        });
    },

    async loadTranslations(language) {
        console.log('[DEBUG] 🔍 loadTranslations() called for language:', language);
        
        try {
            this.translationsLoaded = false;
            const normalizedLang = language.toLowerCase();
            const url = chrome.runtime.getURL(`locales/${normalizedLang}.json`);
            
            console.log('[DEBUG] 🌍 Loading translations from:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${language}`);
            }
            
            this.translations = await response.json();
            this.currentLanguage = normalizedLang;
            this.translationsLoaded = true;
            
            console.log('[SUCCESS] ✅ Translations loaded for:', language);
            return true;
        } catch (error) {
            console.error('[ERROR] ❌ Failed to load translations:', error);
            this.translations = {};
            this.translationsLoaded = false;
            throw error;
        }
    },

    async setLanguage(language) {
        console.log('[DEBUG] 🔍 setLanguage() called with:', language);
        
        try {
            const normalizedLang = language.toLowerCase();
            
            // Skip if language hasn't changed
            if (this.currentLanguage === normalizedLang) {
                console.log('[DEBUG] 🔄 Language unchanged, skipping reload');
                return;
            }
            
            // Load new translations
            await this.loadTranslations(normalizedLang);
            
            // Save language preference
            await chrome.storage.local.set({ language: normalizedLang });
            
            // Update UI
            this.updateInterface();
            
            console.log('[SUCCESS] ✅ Language changed to:', normalizedLang);
        } catch (error) {
            console.error('[ERROR] ❌ Failed to change language:', error);
            throw error;
        }
    },

    translate(key, params = {}) {
        try {
            if (!key) {
                console.warn('[WARNING] ⚠️ Empty translation key');
                return '';
            }

            // Wait for translations if they're not loaded
            if (!this.translationsLoaded) {
                console.warn('[WARNING] ⚠️ Translations not loaded yet, key:', key);
                return key;
            }

            // Split the key into parts (for nested translations)
            const parts = key.split('.');
            let translation = this.translations;

            // Navigate through nested objects
            for (const part of parts) {
                translation = translation?.[part];
                if (translation === undefined) {
                    console.warn('[WARNING] ⚠️ Missing translation for key:', key, {
                        availableKeys: Object.keys(this.translations),
                        currentLanguage: this.currentLanguage
                    });
                    return key;
                }
            }

            // Handle non-string translations
            if (typeof translation !== 'string') {
                console.warn('[WARNING] ⚠️ Invalid translation type for key:', key, {
                    type: typeof translation,
                    value: translation
                });
                return key;
            }

            // Replace parameters in translation
            return translation.replace(/\{(\w+)\}/g, (match, param) => {
                return params[param] !== undefined ? params[param] : match;
            });
        } catch (error) {
            console.error('[ERROR] ❌ Translation error:', error, {
                key,
                params
            });
            return key;
        }
    },

    updateDataI18n() {
        try {
            // Update menu items first to prevent flickering
            document.querySelectorAll('.link-title').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (key) {
                    const translation = this.translate(key);
                    const textElement = element.querySelector('.menu-text');
                    if (textElement) {
                        textElement.textContent = translation;
                    }
                }
            });

            // Update all other elements with data-i18n attribute
            document.querySelectorAll('[data-i18n]:not(.link-title)').forEach(element => {
                const key = element.getAttribute('data-i18n');
                const translation = this.translate(key);
                element.textContent = translation;
            });

            // Update placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
                const key = element.getAttribute('data-i18n-placeholder');
                const translation = this.translate(key);
                element.placeholder = translation;
            });
        } catch (error) {
            console.error('[ERROR] ❌ Failed to update translations in UI:', error);
        }
    },

    updateTooltips() {
        try {
            document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
                const key = element.getAttribute('data-i18n-tooltip');
                const translation = this.translate(key);
                if (translation) {
                    element.title = translation;
                    // Update Bootstrap tooltips if initialized
                    if (element._tippy) {
                        element._tippy.setContent(translation);
                    }
                }
            });
        } catch (error) {
            console.error('[ERROR] ❌ Failed to update tooltips:', error);
        }
    },

    updateInterface() {
        try {
            // Update all elements with data-i18n attribute
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (key) {
                    element.textContent = this.translate(key);
                }
            });

            // Update tooltips
            document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
                const key = element.getAttribute('data-i18n-tooltip');
                if (key) {
                    const tooltipText = this.translate(`tooltips.${key}`);
                    element.setAttribute('title', tooltipText);
                    
                    // Update Bootstrap tooltip if exists
                    const tooltip = bootstrap.Tooltip.getInstance(element);
                    if (tooltip) {
                        tooltip.dispose();
                        new bootstrap.Tooltip(element);
                    }
                }
            });

            // Update placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
                const key = element.getAttribute('data-i18n-placeholder');
                if (key) {
                    element.setAttribute('placeholder', this.translate(key));
                }
            });

            // Dispatch event for other components to update
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: this.currentLanguage }
            }));

            return true;
        } catch (error) {
            console.error('[ERROR] ❌ Failed to update interface:', error);
            return false;
        }
    }
}; 