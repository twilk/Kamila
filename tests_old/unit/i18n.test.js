import { I18nService } from '../../services/i18n.js';

describe('I18n Service', () => {
    let i18n;
    
    beforeEach(() => {
        localStorage.clear();
        i18n = new I18nService();
        global.fetch = jest.fn();
    });

    test('should initialize with default language', () => {
        expect(i18n.currentLanguage).toBe('polish');
    });

    test('should load translations', async () => {
        const mockTranslations = { test: 'Test translation' };
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockTranslations)
        });

        await i18n.init();
        expect(i18n.translations).toEqual(mockTranslations);
    });

    test('should handle missing translations', () => {
        expect(i18n.translate('missing.key')).toBe('missing.key');
    });

    test('should update DOM elements with translations', async () => {
        document.body.innerHTML = '<div data-i18n="test">Old text</div>';
        const mockTranslations = { test: 'New text' };
        
        i18n.translations = mockTranslations;
        i18n.updateDataI18n();
        
        expect(document.querySelector('[data-i18n="test"]').textContent)
            .toBe('New text');
    });
}); 