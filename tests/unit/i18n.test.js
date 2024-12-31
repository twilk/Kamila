import { i18nService } from '../../services/I18nService.js';
import { logService } from '../../services/LogService.js';

describe('I18nService', () => {
    beforeEach(() => {
        localStorage.clear();
        fetch.mockClear();
    });

    test('should use Polish as default language', () => {
        expect(i18nService.currentLanguage).toBe('polish');
    });

    test('should load translations', async () => {
        const mockTranslations = {
            'welcome': 'Welcome',
            'error': 'Error'
        };

        fetch.mockImplementationOnce(() => Promise.resolve({
            json: () => Promise.resolve(mockTranslations)
        }));

        await i18nService.init();
        expect(i18nService.translations).toEqual(mockTranslations);
    });

    test('should handle missing translations', () => {
        expect(i18nService.translate('missing.key')).toBe('missing.key');
    });

    test('should update DOM elements with translations', () => {
        document.body.innerHTML = `
            <div data-i18n="welcome"></div>
            <div data-i18n="error"></div>
        `;

        i18nService.translations = mockTranslations;
        i18nService.updateDataI18n();

        expect(document.querySelector('[data-i18n="welcome"]').textContent)
            .toBe(mockTranslations.welcome);
    });
}); 