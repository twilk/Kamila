import { i18n } from './i18n.js';
import { saveToStorage, STORAGE_KEYS } from './storage.js';

export class LanguageManager {
    static async handleLanguageChange(event) {
        console.log('🌍 LanguageManager: Handling language change...');
        try {
            const lang = event?.target?.value || event?.lang || 'pl';
            console.log('🔤 Selected language:', lang);
            await i18n.setLanguage(lang);
            await saveToStorage(STORAGE_KEYS.LANGUAGE, lang);
            
            // Update all elements with data-i18n attribute
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = i18n.translate(key);
            });

            return true;
        } catch (error) {
            console.error('Error changing language:', error);
            return false;
        }
    }
}

// Export standalone function for backward compatibility
export const handleLanguageChange = LanguageManager.handleLanguageChange; 