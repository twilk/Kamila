import { handleThemeChange, handleLanguageChange, showError, showResponse, initializeBootstrap, initDebugMode, addLogToPanel } from '@/popup';

describe('Popup UI', () => {
    beforeEach(() => {
        // Dodaj mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
                setItem: jest.fn()
            },
            writable: true
        });
        
        document.body.innerHTML = `
            <div id="welcome-message"></div>
            <label for="query"></label>
            <input type="text" id="query" placeholder="">
            <button id="send"></button>
            
            <ul class="nav nav-tabs">
                <li class="nav-item">
                    <button class="nav-link active" data-target="#chat">Chat</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-target="#settings">Ustawienia</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-target="#about">About</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-target="#status">Status</button>
                </li>
            </ul>
        `;

        // Mock Bootstrap Tab
        global.bootstrap = {
            Tab: jest.fn().mockImplementation(() => ({
                show: jest.fn()
            }))
        };

        // Reset i18n state before each test
        i18n.initialized = true;
        i18n.translations = {
            debugPanel: {
                info: 'ℹ️',
                error: '❌',
                success: '✅',
                warning: '⚠️'
            }
        };
    });

    test('should change theme', () => {
        const event = { target: { value: 'dark' } };
        handleThemeChange(event);
        
        expect(document.body.classList.contains('dark-theme')).toBe(true);
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('should change language', async () => {
        const event = {
            target: document.querySelector('.flag'),
            getAttribute: () => 'polish'
        };

        await handleLanguageChange(event);
        expect(localStorage.getItem('language')).toBe('polish');
    });

    test('should show error message', () => {
        const errorMsg = 'Test error';
        showError(errorMsg);
        
        const response = document.getElementById('response');
        expect(response.innerHTML).toContain(errorMsg);
        expect(response.innerHTML).toContain('alert-danger');
    });

    test('should show API response', () => {
        const data = { test: 'value' };
        showResponse(data);
        
        const response = document.getElementById('response');
        expect(response.innerHTML).toContain('value');
    });

    test('should show welcome message', () => {
        const welcome = document.getElementById('welcome-message');
        expect(welcome.textContent).toContain('DARWINA.PL');
    });

    test('should use Polish as default language', () => {
        // Sprawdź czy polska flaga jest aktywna
        const polishFlag = document.querySelector('[data-lang="polish"]');
        expect(polishFlag.classList.contains('active')).toBe(true);
        
        // Sprawdź czy interfejs jest po polsku
        const welcomeMessage = document.getElementById('welcome-message');
        expect(welcomeMessage.textContent).toContain('Inteligentny Asystent');
    });

    describe('Tab Navigation', () => {
        test('should switch tabs correctly', () => {
            // Symuluj kliknięcie w zakładkę Settings
            const settingsTab = document.querySelector('[data-bs-target="#settings"]');
            settingsTab.click();
            
            // Sprawdź czy Bootstrap Tab został zainicjowany
            expect(bootstrap.Tab).toHaveBeenCalled();
            
            // Sprawdź czy metoda show została wywołana
            expect(bootstrap.Tab.mock.results[0].value.show).toHaveBeenCalled();
        });

        test('should show correct content when tab changes', () => {
            const settingsTab = document.querySelector('[data-bs-target="#settings"]');
            
            // Symuluj zdarzenie shown.bs.tab
            const event = new Event('shown.bs.tab');
            event.target = settingsTab;
            settingsTab.dispatchEvent(event);
            
            // Sprawdź czy odpowiedni panel jest aktywny
            const settingsPane = document.querySelector('#settings');
            expect(settingsPane.classList.contains('active')).toBe(true);
            expect(settingsPane.classList.contains('show')).toBe(true);
            
            // Sprawdź czy inne panele są nieaktywne
            const chatPane = document.querySelector('#chat');
            expect(chatPane.classList.contains('active')).toBe(false);
            expect(chatPane.classList.contains('show')).toBe(false);
        });

        test('should maintain tab state after theme change', () => {
            // Aktywuj zakładkę Settings
            const settingsTab = document.querySelector('[data-bs-target="#settings"]');
            settingsTab.click();
            
            // Zmień motyw
            handleThemeChange({ target: { value: 'dark' } });
            
            // Sprawdź czy zakładka Settings nadal jest aktywna
            const settingsPane = document.querySelector('#settings');
            expect(settingsPane.classList.contains('active')).toBe(true);
        });
    });

    describe('Tab Switching', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <ul class="nav nav-tabs">
                    <li class="nav-item">
                        <button class="nav-link active" data-target="#chat">Chat</button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link" data-target="#settings">Settings</button>
                    </li>
                </ul>
                <div class="tab-content">
                    <div class="tab-pane active show" id="chat">Chat Content</div>
                    <div class="tab-pane" id="settings">Settings Content</div>
                </div>
            `;
        });

        test('should switch content when clicking tab', () => {
            // Inicjalizacja
            document.dispatchEvent(new Event('DOMContentLoaded'));
            
            // Kliknij zakładkę Settings
            const settingsTab = document.querySelector('[data-target="#settings"]');
            settingsTab.click();
            
            // Sprawdź stan zakładek
            expect(settingsTab.classList.contains('active')).toBe(true);
            expect(document.querySelector('[data-target="#chat"]').classList.contains('active')).toBe(false);
            
            // Sprawdź stan paneli
            const settingsPane = document.querySelector('#settings');
            const chatPane = document.querySelector('#chat');
            
            expect(settingsPane.classList.contains('show')).toBe(true);
            expect(settingsPane.classList.contains('active')).toBe(true);
            expect(chatPane.classList.contains('show')).toBe(false);
            expect(chatPane.classList.contains('active')).toBe(false);
        });
    });

    describe('Language Settings', () => {
        test('should use Polish as default language', () => {
            // Inicjalizacja
            document.dispatchEvent(new Event('DOMContentLoaded'));
            
            // Sprawdź czy polska flaga jest aktywna
            const polishFlag = document.querySelector('[data-lang="polish"]');
            expect(polishFlag.classList.contains('active')).toBe(true);
            
            // Sprawdź czy inne flagi nie są aktywne
            const otherFlags = document.querySelectorAll('.flag:not([data-lang="polish"])');
            otherFlags.forEach(flag => {
                expect(flag.classList.contains('active')).toBe(false);
            });
            
            // Sprawdź czy interfejs jest po polsku
            const welcomeMessage = document.getElementById('welcome-message');
            expect(welcomeMessage.textContent).toContain('DARWINA.PL');
            
            // Sprawdź localStorage
            expect(localStorage.getItem('language')).toBe('polish');
        });

        test('should change language when clicking flag', async () => {
            // Inicjalizacja
            document.dispatchEvent(new Event('DOMContentLoaded'));
            
            // Kliknij angielską flagę
            const englishFlag = document.querySelector('[data-lang="english"]');
            await englishFlag.click();
            
            // Sprawdź czy angielska flaga jest aktywna
            expect(englishFlag.classList.contains('active')).toBe(true);
            
            // Sprawdź czy polska flaga nie jest już aktywna
            const polishFlag = document.querySelector('[data-lang="polish"]');
            expect(polishFlag.classList.contains('active')).toBe(false);
            
            // Sprawdź localStorage
            expect(localStorage.getItem('language')).toBe('english');
        });
    });

    describe('Language Switching', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="language-switcher">
                    <span class="flag active" data-lang="polish" title="Polski">🇵🇱</span>
                    <span class="flag" data-lang="english" title="English">🇬🇧</span>
                    <span class="flag" data-lang="ukrainian" title="Українська">🇺🇦</span>
                </div>
                <div id="welcome-message"></div>
                <label for="query"></label>
                <input type="text" id="query">
                <button id="send"></button>
            `;
        });

        test('should switch language when clicking flag', async () => {
            // Inicjalizacja
            document.dispatchEvent(new Event('DOMContentLoaded'));
            
            // Symuluj odpowiedź fetch dla tłumaczeń
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        welcome: 'Welcome to KAMILA',
                        queryLabel: 'Your query:',
                        send: 'Send'
                    })
                })
            );
            
            // Kliknij angielską flagę
            const englishFlag = document.querySelector('[data-lang="english"]');
            await englishFlag.click();
            
            // Sprawdź czy flagi mają poprawne klasy
            expect(englishFlag.classList.contains('active')).toBe(true);
            expect(document.querySelector('[data-lang="polish"]').classList.contains('active')).toBe(false);
            
            // Sprawdź czy interfejs został przetłumaczony
            expect(document.getElementById('welcome-message').textContent).toContain('Welcome');
            expect(document.querySelector('label[for="query"]').textContent).toBe('Your query:');
            expect(document.getElementById('send').textContent).toBe('Send');
        });
    });

    test('should initialize debug mode', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();
        expect(document.body.classList.contains('debug-enabled')).toBe(true);
    });

    test('should add logs to panel', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();
        
        addLogToPanel('Test message', 'info');
        const logs = document.querySelectorAll('.log-entry');
        expect(logs.length).toBe(1);
        expect(logs[0].textContent).toContain('Test message');
    });

    test('should maintain state after theme change', () => {
        localStorage.setItem('debugMode', 'true');
        initDebugMode();
        
        addLogToPanel('Test message', 'info');
        document.body.classList.toggle('dark-theme');
        
        const logs = document.querySelectorAll('.log-entry');
        expect(logs.length).toBe(1);
    });

    test('should initialize i18n before UI', async () => {
        await initializeUI();
        expect(i18n.init).toHaveBeenCalledBefore(initializeUIComponents);
    });

    test('should handle i18n initialization failure', async () => {
        i18n.init.mockRejectedValueOnce(new Error('Failed to load translations'));
        
        await initializeUI();
        
        expect(logToPanel).toHaveBeenCalledWith(
            'Error: {message}',
            'error',
            expect.any(Error)
        );
    });

    test('should use fallback prefixes when i18n is not initialized', async () => {
        i18n.initialized = false;
        i18n.translations = {};
        
        logToPanel('Test message', 'info');
        
        expect(document.querySelector('.log-entry').innerHTML)
            .toContain('ℹ️ Test message');
    });

    describe('Error Handling', () => {
        test('should show error container when showError is called', () => {
            showError('Test error message');
            
            const errorContainer = document.querySelector('.error-container');
            expect(errorContainer).toBeInTheDocument();
            expect(errorContainer.textContent).toBe('Test error message');
            expect(errorContainer.classList.contains('show')).toBe(true);
        });

        test('should automatically hide error after 5 seconds', () => {
            jest.useFakeTimers();
            
            showError('Test error message');
            const errorContainer = document.querySelector('.error-container');
            
            expect(errorContainer.classList.contains('show')).toBe(true);
            
            jest.advanceTimersByTime(5000);
            
            expect(errorContainer.classList.contains('show')).toBe(false);
            
            jest.useRealTimers();
        });

        test('should handle error when creating error container fails', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            document.body.appendChild = jest.fn().mockImplementation(() => {
                throw new Error('Failed to append');
            });
            
            showError('Test error message');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to show error:',
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('Initialization', () => {
        test('should initialize i18n before UI', async () => {
            await initializeUI();
            expect(i18n.init).toHaveBeenCalledBefore(initializeUIComponents);
        });

        test('should handle i18n initialization failure', async () => {
            i18n.init.mockRejectedValueOnce(new Error('Failed to load translations'));
            
            await initializeUI();
            
            expect(logToPanel).toHaveBeenCalledWith(
                'Error: {message}',
                'error',
                expect.any(Error)
            );
        });

        test('should use fallback prefixes when i18n is not initialized', async () => {
            i18n.initialized = false;
            i18n.translations = {};
            
            logToPanel('Test message', 'info');
            
            expect(document.querySelector('.log-entry').innerHTML)
                .toContain('ℹ️ Test message');
        });

        test('should handle missing API credentials', async () => {
            getDarwinaCredentials.mockResolvedValueOnce({});
            
            await initializeUI();
            
            expect(logToPanel).toHaveBeenCalledWith(
                'Error: {message}',
                'error',
                expect.any(Error)
            );
        });
    });
}); 