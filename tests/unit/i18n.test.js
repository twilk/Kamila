import { i18n } from '../../services/i18n.js';

describe('I18nService', () => {
    beforeEach(() => {
        // Reset localStorage
        localStorage.clear();
        
        // Reset i18n instance
        i18n.translations = {};
        i18n.currentLanguage = 'polish';
        i18n.initialized = false;
    });

    test('should initialize with default language', async () => {
        await i18n.init();
        expect(i18n.currentLanguage).toBe('polish');
        expect(i18n.initialized).toBe(true);
    });

    test('should handle missing translations gracefully', () => {
        const key = 'nonexistent.key';
        const translation = i18n.translate(key);
        expect(translation).toBe(key);
    });

    test('should validate language before switching', async () => {
        await expect(i18n.setLanguage('invalid')).rejects.toThrow('Unsupported language');
    });

    test('should use fallback translations on error', async () => {
        // Mock fetch to fail
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        
        await i18n.init();
        
        expect(i18n.translate('error')).toBe('Error');
        expect(i18n.translate('loading')).toBe('Loading...');
    });
}); 