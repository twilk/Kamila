import { i18n } from '../../services/i18n.js';
import { LanguageManager } from '../../services/languageManager.js';
import { EventManager } from '../../services/eventManager.js';

describe('I18n Service', () => {
    let eventManager;
    let languageManager;

    beforeEach(async () => {
        // Clear storage and reset state
        await chrome.storage.local.clear();
        eventManager = new EventManager();
        languageManager = new LanguageManager(eventManager);
        await i18n.init();
    });

    describe('getCurrentLanguage', () => {
        it('should return current language', () => {
            expect(i18n.getCurrentLanguage()).toBe('polish');
        });

        it('should be synchronized with LanguageManager', async () => {
            await languageManager.handleLanguageChange({ lang: 'english' });
            expect(i18n.getCurrentLanguage()).toBe('english');
            expect(languageManager.getCurrentLanguage()).toBe('english');
        });
    });

    describe('waitForTranslations', () => {
        it('should wait for translations to load', async () => {
            await i18n.waitForTranslations();
            expect(i18n.translationsLoaded).toBe(true);
            expect(Object.keys(i18n.translations).length).toBeGreaterThan(0);
        });

        it('should not reload translations if already loaded', async () => {
            const spy = jest.spyOn(i18n, 'loadTranslations');
            await i18n.waitForTranslations();
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('Language synchronization', () => {
        it('should emit event on language change', async () => {
            const spy = jest.spyOn(eventManager, 'emit');
            await languageManager.handleLanguageChange({ lang: 'english' });
            expect(spy).toHaveBeenCalledWith('languageChanged', { language: 'english' });
            spy.mockRestore();
        });

        it('should handle invalid language gracefully', async () => {
            const result = await languageManager.handleLanguageChange({ lang: 'invalid' });
            expect(result).toBe(false);
            expect(i18n.getCurrentLanguage()).toBe('polish');
        });
    });
}); 