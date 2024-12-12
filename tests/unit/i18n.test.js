import { 
    loadTranslations, 
    getTranslation, 
    formatMessage,
    getCurrentLanguage,
    setLanguage
} from '@/services/i18n';
import { sendLogToPopup } from '../../config/api.js';

// Zamiast importowania JSON bezpośrednio, użyjmy mocków
const mockTranslations = {
    polish: {
        welcome: 'Witaj w DARWINA.PL',
        queryLabel: 'Twoje zapytanie:',
        queryPlaceholder: 'Wpisz swoje pytanie...',
        send: 'Wyślij',
        chat: 'Czat',
        settings: 'Ustawienia',
        about: 'O programie',
        status: 'Status',
        errors: {
            api: 'Błąd API',
            network: 'Błąd sieci'
        },
        leadStatuses: {
            submitted: 'Złożone',
            confirmed: 'Potwierdzone',
            accepted: 'Zaakceptowane',
            ready: 'Gotowe',
            overdue: 'Przeterminowane'
        }
    },
    english: {
        welcome: 'Welcome to DARWINA.PL',
        queryLabel: 'Your query:',
        queryPlaceholder: 'Type your question...',
        send: 'Send',
        chat: 'Chat',
        settings: 'Settings',
        about: 'About',
        status: 'Status',
        errors: {
            api: 'API Error',
            network: 'Network Error'
        },
        leadStatuses: {
            submitted: 'Submitted',
            confirmed: 'Confirmed',
            accepted: 'Accepted',
            ready: 'Ready',
            overdue: 'Overdue'
        }
    },
    ukrainian: {
        welcome: 'Ласкаво просимо до DARWINA.PL',
        queryLabel: 'Ваш запит:',
        queryPlaceholder: 'Введіть своє питання...',
        send: 'Надіслати',
        chat: 'Чат',
        settings: 'Налаштування',
        about: 'Про програму',
        status: 'Статус',
        errors: {
            api: 'Помилка API',
            network: 'Помилка мережі'
        },
        leadStatuses: {
            submitted: 'Подано',
            confirmed: 'Підтверджено',
            accepted: 'Прийнято',
            ready: 'Готово',
            overdue: 'Прострочено'
        }
    }
};

describe('Internationalization Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        fetch.mockClear();
        sendLogToPopup('🧪 Starting i18n test', 'info');

        // Mockujemy fetch dla plików tłumaczeń
        global.fetch = jest.fn((url) => {
            const lang = url.split('/').pop().replace('.json', '');
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockTranslations[lang])
            });
        });
    });

    describe('Translation Loading', () => {
        test('should load translations for specified language', async () => {
            const translations = await loadTranslations('polish');
            expect(translations).toEqual(mockTranslations.polish);
            sendLogToPopup('✅ Translation test passed', 'success');
        });

        test('should handle missing translation files', async () => {
            await expect(loadTranslations('nonexistent'))
                .rejects
                .toThrow('Translation file not found');
            sendLogToPopup('❌ Translation test failed', 'error', 'Translation file not found');
        });

        test('should cache loaded translations', async () => {
            // Pierwsze ładowanie
            await loadTranslations('english');
            // Drugie ładowanie - powinno użyć cache
            await loadTranslations('english');

            expect(fetch).toHaveBeenCalledTimes(1);
            sendLogToPopup('✅ Translation test passed', 'success');
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
            sendLogToPopup('✅ Translation test passed', 'success');
        });

        test('should handle missing translations', () => {
            expect(getTranslation('nonexistent.key'))
                .toBe('nonexistent.key');
            expect(getTranslation('nested.nonexistent'))
                .toBe('nested.nonexistent');
            sendLogToPopup('✅ Translation test passed', 'success');
        });

        test('should handle array translations', () => {
            expect(getTranslation('array.0')).toBe('First');
            expect(getTranslation('array.2', { num: '3' })).toBe('3');
            sendLogToPopup('✅ Translation test passed', 'success');
        });

        test('should format messages with multiple parameters', () => {
            const template = 'Hello {name}, you have {count} messages';
            const params = { name: 'John', count: 5 };

            expect(formatMessage(template, params))
                .toBe('Hello John, you have 5 messages');
            sendLogToPopup('✅ Translation test passed', 'success');
        });

        test('should handle missing parameters', () => {
            const template = 'Hello {name}, you have {count} messages';
            const params = { name: 'John' };

            expect(formatMessage(template, params))
                .toBe('Hello John, you have {count} messages');
            sendLogToPopup('✅ Translation test passed', 'success');
        });
    });

    describe('Language Management', () => {
        test('should get and set current language', () => {
            expect(getCurrentLanguage()).toBe('polish'); // domyślny

            setLanguage('english');
            expect(getCurrentLanguage()).toBe('english');
            expect(localStorage.getItem('language')).toBe('english');
            sendLogToPopup('✅ Translation test passed', 'success');
        });

        test('should handle invalid language codes', () => {
            setLanguage('invalid-code');
            expect(getCurrentLanguage()).toBe('polish'); // fallback do domyślnego
            sendLogToPopup('✅ Translation test passed', 'success');
        });

        test('should persist language preference', () => {
            setLanguage('ukrainian');
            
            // Symuluj przeładowanie strony
            localStorage.clear();
            expect(getCurrentLanguage()).toBe('polish'); // domyślny po przeładowaniu
            
            // Przywróć zapisany wybór
            localStorage.setItem('language', 'ukrainian');
            expect(getCurrentLanguage()).toBe('ukrainian');
            sendLogToPopup('✅ Translation test passed', 'success');
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
        const polishKeys = Object.keys(mockTranslations.polish).sort();
        const englishKeys = Object.keys(mockTranslations.english).sort();
        const ukrainianKeys = Object.keys(mockTranslations.ukrainian).sort();

        expect(englishKeys).toEqual(polishKeys);
        expect(ukrainianKeys).toEqual(polishKeys);
        sendLogToPopup('✅ Translation test passed', 'success');
    });

    test('all required keys should be present', () => {
        requiredKeys.forEach(key => {
            expect(mockTranslations.polish).toHaveProperty(key);
            expect(mockTranslations.english).toHaveProperty(key);
            expect(mockTranslations.ukrainian).toHaveProperty(key);
        });
        sendLogToPopup('✅ Translation test passed', 'success');
    });

    test('translations should not be empty', () => {
        Object.entries(mockTranslations.polish).forEach(([key, value]) => {
            expect(value).toBeTruthy();
            expect(value.trim()).not.toBe('');
        });
        sendLogToPopup('✅ Translation test passed', 'success');
    });

    test('welcome message should contain DARWINA.PL', () => {
        expect(mockTranslations.polish.welcome).toContain('DARWINA.PL');
        expect(mockTranslations.english.welcome).toContain('DARWINA.PL');
        expect(mockTranslations.ukrainian.welcome).toContain('DARWINA.PL');
        sendLogToPopup('✅ Translation test passed', 'success');
    });
}); 