import { i18nService } from '../../services/I18nService.js';
import { logService } from '../../services/LogService.js';

describe('I18nService', () => {
    beforeEach(() => {
        localStorage.clear();
        fetch.mockClear();
        i18nService.cleanup();
        // Mock chrome.storage.local
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn()
                }
            }
        };
    });

    test('should use Polish as default language', () => {
        expect(i18nService.currentLanguage).toBe('polish');
        expect(i18nService.defaultLanguage).toBe('polish');
    });

    test('should load translations', async () => {
        const mockTranslations = {
            polish: {
                welcome: 'Witaj',
                error: 'Błąd'
            },
            english: {
                welcome: 'Welcome',
                error: 'Error'
            },
            ukrainian: {
                welcome: 'Вітаємо',
                error: 'Помилка'
            }
        };

        fetch.mockImplementation((url) => {
            const lang = url.includes('polish.json') ? 'polish' :
                        url.includes('english.json') ? 'english' :
                        'ukrainian';
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockTranslations[lang])
            });
        });

        await i18nService.initialize();
        expect(i18nService.translations).toEqual(mockTranslations);
    });

    test('should handle missing translations', () => {
        i18nService.translations = {
            polish: {
                welcome: 'Witaj'
            }
        };
        expect(i18nService.translate('missing.key')).toBe('missing.key');
    });

    test('should handle empty translation key', () => {
        i18nService.translations = {
            polish: {
                welcome: 'Witaj'
            }
        };
        expect(i18nService.translate('')).toBe('');
        expect(i18nService.translate(null)).toBe('');
        expect(i18nService.translate(undefined)).toBe('');
    });

    test('should change language', async () => {
        i18nService.translations = {
            polish: { welcome: 'Witaj' },
            english: { welcome: 'Welcome' },
            ukrainian: { welcome: 'Вітаємо' }
        };

        await i18nService.setLanguage('english');
        expect(i18nService.currentLanguage).toBe('english');
        expect(i18nService.translate('welcome')).toBe('Welcome');

        await i18nService.setLanguage('ukrainian');
        expect(i18nService.currentLanguage).toBe('ukrainian');
        expect(i18nService.translate('welcome')).toBe('Вітаємо');
    });

    test('should handle invalid language change', async () => {
        i18nService.translations = {
            polish: { welcome: 'Witaj' },
            english: { welcome: 'Welcome' }
        };

        const result = await i18nService.setLanguage('invalid');
        expect(result).toBe(false);
        expect(i18nService.currentLanguage).toBe('polish');
    });

    test('should fallback to default language', () => {
        i18nService.translations = {
            polish: { welcome: 'Witaj' },
            english: {}
        };
        i18nService.currentLanguage = 'english';
        expect(i18nService.translate('welcome')).toBe('Witaj');
    });

    test('should handle nested translations', () => {
        i18nService.translations = {
            polish: {
                leadStatuses: {
                    submitted: 'Złożone',
                    confirmed: 'Potwierdzone'
                }
            }
        };
        expect(i18nService.translate('leadStatuses.submitted')).toBe('Złożone');
        expect(i18nService.translate('leadStatuses.confirmed')).toBe('Potwierdzone');
        expect(i18nService.translate('leadStatuses.nonexistent')).toBe('leadStatuses.nonexistent');
    });

    test('should handle deeply nested translations', () => {
        i18nService.translations = {
            polish: {
                services: {
                    api: {
                        errors: {
                            connection: 'Błąd połączenia',
                            timeout: 'Przekroczono limit czasu'
                        }
                    }
                }
            }
        };
        expect(i18nService.translate('services.api.errors.connection')).toBe('Błąd połączenia');
        expect(i18nService.translate('services.api.errors.timeout')).toBe('Przekroczono limit czasu');
    });

    test('should handle broken translation paths', () => {
        i18nService.translations = {
            polish: {
                services: 'Not an object'
            }
        };
        expect(i18nService.translate('services.api.error')).toBe('services.api.error');
    });

    test('should persist language preference', async () => {
        chrome.storage.local.get.mockImplementation((key, callback) => {
            callback({ language: 'english' });
        });
        
        await i18nService.loadStoredLanguage();
        expect(i18nService.currentLanguage).toBe('english');
    });

    test('should handle storage errors gracefully', async () => {
        chrome.storage.local.get.mockImplementation(() => {
            throw new Error('Storage error');
        });
        
        await i18nService.loadStoredLanguage();
        expect(i18nService.currentLanguage).toBe('polish');
    });

    test('should update DOM elements with translations', () => {
        document.body.innerHTML = `
            <div data-i18n="welcome"></div>
            <div data-i18n="error"></div>
            <div data-i18n="nested.translation"></div>
            <input type="text" data-i18n-placeholder="enterText">
            <button title="Click me" data-i18n-tooltip="buttonTooltip"></button>
        `;

        i18nService.translations = {
            polish: {
                welcome: 'Witaj',
                error: 'Błąd',
                nested: {
                    translation: 'Zagnieżdżone tłumaczenie'
                },
                enterText: 'Wprowadź tekst',
                buttonTooltip: 'Kliknij mnie'
            }
        };

        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = i18nService.translate(key);
        });

        expect(document.querySelector('[data-i18n="welcome"]').textContent).toBe('Witaj');
        expect(document.querySelector('[data-i18n="error"]').textContent).toBe('Błąd');
        expect(document.querySelector('[data-i18n="nested.translation"]').textContent)
            .toBe('Zagnieżdżone tłumaczenie');
    });

    test('should cleanup properly', () => {
        i18nService.translations = {
            polish: { welcome: 'Witaj' },
            english: { welcome: 'Welcome' }
        };
        i18nService.currentLanguage = 'english';
        i18nService.initialized = true;

        i18nService.cleanup();

        expect(i18nService.translations).toEqual({});
        expect(i18nService.currentLanguage).toBe('polish');
        expect(i18nService.initialized).toBe(false);
    });

    test('should have consistent language names across translation files', async () => {
        const mockTranslations = {
            polish: {
                languagePolish: 'Polski',
                languageEnglish: 'Angielski',
                languageUkrainian: 'Ukraiński'
            },
            english: {
                languagePolish: 'Polish',
                languageEnglish: 'English',
                languageUkrainian: 'Ukrainian'
            },
            ukrainian: {
                languagePolish: 'Польська',
                languageEnglish: 'Англійська',
                languageUkrainian: 'Українська'
            }
        };

        fetch.mockImplementation((url) => {
            const lang = url.includes('polish.json') ? 'polish' :
                        url.includes('english.json') ? 'english' :
                        'ukrainian';
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockTranslations[lang])
            });
        });

        await i18nService.initialize();

        // Verify each language has translations for all language names
        const languages = ['polish', 'english', 'ukrainian'];
        const languageKeys = ['languagePolish', 'languageEnglish', 'languageUkrainian'];

        languages.forEach(lang => {
            languageKeys.forEach(key => {
                expect(i18nService.translations[lang][key]).toBeDefined();
                expect(typeof i18nService.translations[lang][key]).toBe('string');
                expect(i18nService.translations[lang][key].length).toBeGreaterThan(0);
            });
        });
    });
}); 