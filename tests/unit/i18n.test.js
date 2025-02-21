import { languageManager } from '../../services/core/LanguageManager.js';

describe('LanguageManager', () => {
    beforeEach(() => {
        // Reset language manager before each test
        languageManager.reset();
    });

    describe('initialization', () => {
        test('should initialize with default language', async () => {
            await languageManager.initialize();
            expect(languageManager.getCurrentLanguage()).toBe('polish');
            expect(languageManager.isInitialized()).toBe(true);
        });

        test('should load translations for default language', async () => {
            await languageManager.initialize();
            expect(languageManager.translate('app.title')).toBeDefined();
            expect(languageManager.translate('app.title')).not.toBe('app.title');
        });
    });

    describe('language switching', () => {
        test('should change language', async () => {
            await languageManager.initialize();
            await languageManager.setLanguage('english');
            expect(languageManager.getCurrentLanguage()).toBe('english');
        });

        test('should persist language preference', async () => {
            await languageManager.initialize();
            await languageManager.setLanguage('english');
            
            // Create new instance to test persistence
            const newManager = new LanguageManager();
            await newManager.initialize();
            expect(newManager.getCurrentLanguage()).toBe('english');
        });
    });

    describe('translation handling', () => {
        test('should handle missing translations', () => {
            expect(languageManager.translate('nonexistent.key')).toBe('nonexistent.key');
        });

        test('should handle translation with parameters', async () => {
            await languageManager.initialize();
            const translated = languageManager.translate('statusChangeFormat', {
                status: 'Test',
                previous: 5,
                current: 10
            });
            expect(translated).toContain('Test');
            expect(translated).toContain('5');
            expect(translated).toContain('10');
        });
    });

    describe('UI updates', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div data-i18n="app.title">Test</div>
                <div data-i18n="app.welcome">Welcome</div>
                <input data-i18n-placeholder="queryPlaceholder" placeholder="Old">
                <button data-i18n-tooltip="buttonTooltip" title="Old">Button</button>
            `;
        });

        test('should update UI elements with translations', async () => {
            await languageManager.initialize();
            await languageManager.updateUI();

            const titleElement = document.querySelector('[data-i18n="app.title"]');
            expect(titleElement.textContent).not.toBe('Test');
        });

        test('should update placeholders', async () => {
            await languageManager.initialize();
            await languageManager.updateUI();

            const input = document.querySelector('[data-i18n-placeholder]');
            expect(input.placeholder).not.toBe('Old');
        });

        test('should update tooltips', async () => {
            await languageManager.initialize();
            await languageManager.updateUI();

            const button = document.querySelector('[data-i18n-tooltip]');
            expect(button.title).not.toBe('Old');
        });
    });
}); 