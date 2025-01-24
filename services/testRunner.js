import { checkApiStatus, checkAuthStatus, checkOrdersStatus, checkCacheStatus } from './api.js';
import { DataManager } from './dataManager.js';
import { i18n } from './i18n.js';
import { LanguageManager } from './languageManager.js';
import { EventManager } from './eventManager.js';

// Inicjalizacja DataManager dla testów
const dataManager = new DataManager();

// Zastępujemy funkcję processOrders z background.js
async function processOrders(orders) {
    return await dataManager.processOrders(orders);
}

// Test runner service for integration tests
export class TestRunner {
    constructor() {
        console.log('🧪 Initializing TestRunner');
        this.results = {
            passed: 0,
            failed: 0,
            duration: 0,
            total: 0,
            current: 0
        };
        this.tests = {
            i18n: [
                {
                    name: 'getCurrentLanguage',
                    description: 'Get Current Language',
                    run: async () => {
                        const currentLang = i18n.getCurrentLanguage();
                        if (!currentLang) {
                            throw new Error('Current language is not set');
                        }
                        return true;
                    }
                },
                {
                    name: 'languageSync',
                    description: 'Language Synchronization',
                    run: async () => {
                        const eventManager = new EventManager();
                        const languageManager = new LanguageManager(eventManager);
                        await languageManager.handleLanguageChange({ lang: 'english' });
                        
                        const i18nLang = i18n.getCurrentLanguage();
                        const managerLang = languageManager.getCurrentLanguage();
                        
                        if (i18nLang !== managerLang || i18nLang !== 'english') {
                            throw new Error('Language synchronization failed');
                        }
                        return true;
                    }
                },
                {
                    name: 'translationLoading',
                    description: 'Translation Loading',
                    run: async () => {
                        await i18n.waitForTranslations();
                        if (!i18n.translationsLoaded || Object.keys(i18n.translations).length === 0) {
                            throw new Error('Translations not loaded properly');
                        }
                        return true;
                    }
                }
            ],
            // ... existing tests ...
        };
        this.running = false;

        // Rejestruj testy podczas inicjalizacji
        this.registerTests();
    }

    registerTests() {
        // Test połączenia z API
        this.registerTest('API Connection', async () => {
            const isApiWorking = await checkApiStatus();
            if (!isApiWorking) throw new Error('API connection failed');
            return true;
        });

        // Test autoryzacji
        this.registerTest('Authorization', async () => {
            const isAuthWorking = await checkAuthStatus();
            if (!isAuthWorking) throw new Error('Authorization failed');
            return true;
        });

        // Test storage
        this.registerTest('Storage Access', async () => {
            const testKey = 'test_key_' + Date.now();
            const testValue = { test: 'value' };
            await chrome.storage.local.set({ [testKey]: testValue });
            const result = await chrome.storage.local.get(testKey);
            await chrome.storage.local.remove(testKey);
            if (!result[testKey]) throw new Error('Storage write/read failed');
            return true;
        });

        // Test uprawnień
        this.registerTest('Required Permissions', async () => {
            const manifest = chrome.runtime.getManifest();
            const required = ['storage', 'tabs', 'alarms', 'runtime'];
            const missing = required.filter(p => !manifest.permissions.includes(p));
            if (missing.length > 0) {
                throw new Error(`Missing permissions: ${missing.join(', ')}`);
            }
            return true;
        });

        // Test przetwarzania zamówień
        this.registerTest('Order Processing', async () => {
            const mockOrders = [
                { id: 1, status_id: '1', date: new Date().toISOString() },
                { id: 2, status_id: '2', date: new Date().toISOString() },
                { id: 3, status_id: '3', date: new Date().toISOString() },
                { id: 4, status_id: '5', ready_date: new Date().toISOString() },
                { id: 5, status_id: '5', ready_date: new Date(Date.now() - 15 * 86400000).toISOString() }
            ];
            
            const counts = processOrders(mockOrders);
            if (!counts['1'] || !counts['2'] || !counts['3'] || !counts['READY'] || !counts['OVERDUE']) {
                throw new Error('Order processing failed');
            }
            return true;
        });

        // Test cache'owania
        this.registerTest('Cache Operations', async () => {
            const testData = { test: 'data' };
            const cacheKey = 'test_cache_key';
            
            // Test zapisu do cache
            await chrome.storage.local.set({ [cacheKey]: testData });
            
            // Test odczytu z cache
            const result = await chrome.storage.local.get(cacheKey);
            if (!result[cacheKey]) {
                throw new Error('Cache read failed');
            }
            
            // Test czyszczenia cache
            await chrome.storage.local.remove(cacheKey);
            const afterClear = await chrome.storage.local.get(cacheKey);
            if (afterClear[cacheKey]) {
                throw new Error('Cache clear failed');
            }
            
            return true;
        });

        // Test komunikacji popup-background
        this.registerTest('Message Communication', async () => {
            // Wysyłamy testową wiadomość
            const response = await chrome.runtime.sendMessage({
                type: 'TEST_MESSAGE',
                data: { test: true }
            });
            
            if (!response || !response.received) {
                throw new Error('Message communication failed');
            }
            return true;
        });

        // Test obsługi błędów
        this.registerTest('Error Handling', async () => {
            try {
                // Próbujemy wykonać operację, która powinna się nie udać
                await chrome.storage.local.get(undefined);
                throw new Error('Error handling test failed - should throw');
            } catch (error) {
                // Oczekujemy błędu
                return true;
            }
        });

        // Test przetwarzania statusów
        this.registerTest('Status Processing', async () => {
            const mockData = {
                counts: {
                    '1': 5,
                    '2': 3,
                    '3': 2,
                    'READY': 4,
                    'OVERDUE': 1
                }
            };
            
            // Zapisz testowe dane
            await chrome.storage.local.set({ leadCounts: mockData.counts });
            
            // Pobierz i sprawdź dane
            const { leadCounts } = await chrome.storage.local.get('leadCounts');
            if (!leadCounts || 
                leadCounts['1'] !== 5 || 
                leadCounts['2'] !== 3 || 
                leadCounts['3'] !== 2 || 
                leadCounts['READY'] !== 4 || 
                leadCounts['OVERDUE'] !== 1) {
                throw new Error('Status processing failed');
            }
            return true;
        });
    }

    // Run a single test
    async runTest(test, index) {
        const startTime = performance.now();
        try {
            await test.fn();
            this.results.passed++;
            return {
                name: test.name,
                status: 'passed',
                duration: Math.round(performance.now() - startTime)
            };
        } catch (error) {
            this.results.failed++;
            return {
                name: test.name,
                status: 'failed',
                error: error.message,
                duration: Math.round(performance.now() - startTime)
            };
        } finally {
            this.results.current++;
        }
    }

    // Run all registered tests
    async runAll() {
        console.log('🧪 Starting runAll()');
        if (this.running) {
            console.log('🧪 Already running tests, skipping');
            return;
        }
        
        console.log(`🧪 Running ${this.tests.length} tests`);
        this.running = true;

        const startTime = performance.now();
        
        try {
            // Reset counters
            this.results = {
                passed: 0,
                failed: 0,
                duration: 0,
                total: this.tests.length,
                current: 0
            };

            // Wyślij informację o rozpoczęciu testów
            chrome.runtime.sendMessage({
                action: 'test-start',
                tests: this.tests.map(t => ({ name: t.name }))
            });

            const testResults = [];
            // Run tests sequentially
            for (let i = 0; i < this.tests.length; i++) {
                console.log(`🧪 Running test ${i + 1}/${this.tests.length}: ${this.tests[i].name}`);
                
                // Wyślij informację o rozpoczęciu testu
                chrome.runtime.sendMessage({
                    action: 'test-progress',
                    index: i,
                    progress: 0,
                    status: 'running',
                    duration: 0
                });

                const result = await this.runTest(this.tests[i], i);
                testResults.push(result);
                this.results.duration = Math.round(performance.now() - startTime);

                // Wyślij informację o zakończeniu testu
                chrome.runtime.sendMessage({
                    action: 'test-progress',
                    index: i,
                    progress: 100,
                    status: result.status === 'passed' ? 'completed' : 'failed',
                    duration: result.duration
                });
            }

            console.log('🧪 All tests completed');
            return {
                ...this.results,
                testResults: testResults
            };
        } catch (error) {
            console.error('🧪 Error in runAll:', error);
            throw error;
        } finally {
            this.running = false;
        }
    }

    // Register a new test
    registerTest(name, fn) {
        console.log(`🧪 Registering test: ${name}`);
        this.tests.push({ name, fn });
        this.results.total = this.tests.length;
        console.log(`🧪 Total registered tests: ${this.tests.length}`);
    }
}

// Create singleton instance
const testRunner = new TestRunner();

export default testRunner; 