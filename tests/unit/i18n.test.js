import { 
    loadTranslations, 
    getTranslation, 
    formatMessage,
    getCurrentLanguage,
    setLanguage
} from '@/services/i18n';
import polishTranslations from '@/locales/polish.json';
import englishTranslations from '@/locales/english.json';
import ukrainianTranslations from '@/locales/ukrainian.json';

describe('Internationalization Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        fetch.mockClear();
    });

    describe('Translation Loading', () => {
        test('should load translations for specified language', async () => {
            const mockPolishTranslations = {
                welcome: 'Witaj',
                errors: {
                    api: 'Błąd API',
                    network: 'Błąd sieci'
                },
                leadStatuses: {
                    submitted: 'Złożone',
                    confirmed: 'Potwierdzone'
                }
            };

            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockPolishTranslations)
            }));

            const translations = await loadTranslations('polish');
            expect(translations).toEqual(mockPolishTranslations);
        });

        test('should handle missing translation files', async () => {
            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 404
            }));

            await expect(loadTranslations('nonexistent'))
                .rejects
                .toThrow('Translation file not found');
        });

        test('should cache loaded translations', async () => {
            const mockTranslations = { welcome: 'Hello' };

            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockTranslations)
            }));

            // Pierwsze ładowanie
            await loadTranslations('english');
            // Drugie ładowanie - powinno użyć cache
            await loadTranslations('english');

            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Translation Usage', () => {
        const mockTranslations = {
            greeting: 'Hello {name}!',
            nested: {
                key: 'Nested value for {param}',
                deep: {
                    value: 'Deep {what}'
                }
            },
            array: ['First', 'Second', '{num}']
        };

        beforeEach(() => {
            jest.spyOn(window, 'getTranslations')
                .mockReturnValue(mockTranslations);
        });

        test('should get translation by key path', () => {
            expect(getTranslation('greeting', { name: 'John' }))
                .toBe('Hello John!');
            expect(getTranslation('nested.key', { param: 'test' }))
                .toBe('Nested value for test');
            expect(getTranslation('nested.deep.value', { what: 'testing' }))
                .toBe('Deep testing');
        });

        test('should handle missing translations', () => {
            expect(getTranslation('nonexistent.key'))
                .toBe('nonexistent.key');
            expect(getTranslation('nested.nonexistent'))
                .toBe('nested.nonexistent');
        });

        test('should handle array translations', () => {
            expect(getTranslation('array.0')).toBe('First');
            expect(getTranslation('array.2', { num: '3' })).toBe('3');
        });

        test('should format messages with multiple parameters', () => {
            const template = 'Hello {name}, you have {count} messages';
            const params = { name: 'John', count: 5 };

            expect(formatMessage(template, params))
                .toBe('Hello John, you have 5 messages');
        });

        test('should handle missing parameters', () => {
            const template = 'Hello {name}, you have {count} messages';
            const params = { name: 'John' };

            expect(formatMessage(template, params))
                .toBe('Hello John, you have {count} messages');
        });
    });

    describe('Language Management', () => {
        test('should get and set current language', () => {
            expect(getCurrentLanguage()).toBe('polish'); // domyślny

            setLanguage('english');
            expect(getCurrentLanguage()).toBe('english');
            expect(localStorage.getItem('language')).toBe('english');
        });

        test('should handle invalid language codes', () => {
            setLanguage('invalid-code');
            expect(getCurrentLanguage()).toBe('polish'); // fallback do domyślnego
        });

        test('should persist language preference', () => {
            setLanguage('ukrainian');
            
            // Symuluj przeładowanie strony
            localStorage.clear();
            expect(getCurrentLanguage()).toBe('polish'); // domyślny po przeładowaniu
            
            // Przywróć zapisany wybór
            localStorage.setItem('language', 'ukrainian');
            expect(getCurrentLanguage()).toBe('ukrainian');
        });
    });
});

describe('Translations', () => {
    const requiredKeys = [
        'welcome',
        'queryLabel',
        'queryPlaceholder',
        'send',
        'chat',
        'settings',
        'about',
        'status'
    ];

    test('all translations should have the same keys', () => {
        const polishKeys = Object.keys(polishTranslations).sort();
        const englishKeys = Object.keys(englishTranslations).sort();
        const ukrainianKeys = Object.keys(ukrainianTranslations).sort();

        expect(englishKeys).toEqual(polishKeys);
        expect(ukrainianKeys).toEqual(polishKeys);
    });

    test('all required keys should be present', () => {
        requiredKeys.forEach(key => {
            expect(polishTranslations).toHaveProperty(key);
            expect(englishTranslations).toHaveProperty(key);
            expect(ukrainianTranslations).toHaveProperty(key);
        });
    });

    test('translations should not be empty', () => {
        [polishTranslations, englishTranslations, ukrainianTranslations].forEach(translations => {
            Object.entries(translations).forEach(([key, value]) => {
                expect(value).toBeTruthy();
                expect(value.trim()).not.toBe('');
            });
        });
    });

    test('welcome message should contain DARWINA.PL', () => {
        expect(polishTranslations.welcome).toContain('DARWINA.PL');
        expect(englishTranslations.welcome).toContain('DARWINA.PL');
        expect(ukrainianTranslations.welcome).toContain('DARWINA.PL');
    });
}); 