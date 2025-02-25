import { checkApiStatus, checkAuthStatus, checkOrdersStatus, checkCacheStatus } from './api.js';
import { 
    getDataManager,
    getErrorHandler,
    getEventManager,
    getLanguageManager
} from './core/managers.js';

// Initialize managers
const dataManager = getDataManager();
const errorHandler = getErrorHandler();
const eventManager = getEventManager();
const languageManager = getLanguageManager();

// Don't create new instance, use the one from managers
// const testDataManager = DataManager.getInstance();

// Zastępujemy funkcję processOrders z background.js
async function processOrders(orders) {
    try {
        // Wait for dataManager to be ready
        if (!dataManager.isInitialized()) {
            const ready = await dataManager.waitForReady();
            if (!ready) {
                throw new Error('DataManager failed to initialize');
            }
        }
        
        return await dataManager.processOrderCounts(orders);
    } catch (error) {
        console.error('Error processing orders:', error);
        throw error;
    }
}

// Test runner service for integration tests
class TestRunner {
    static #instance = null;

    constructor() {
        if (TestRunner.#instance) {
            throw new Error('Use TestRunner.getInstance()');
        }
        console.log('🧪 Initializing TestRunner');
        this.results = {
            passed: 0,
            failed: 0,
            duration: 0,
            total: 0,
            current: 0
        };
        
        // Initialize tests as an array
        this.tests = [];

        // Add language tests
        this.registerTest('Current Language', async () => {
            const currentLang = languageManager.getCurrentLanguage();
            if (!(currentLang === 'polish' || currentLang === 'english')) {
                throw new Error(`Invalid language: ${currentLang}`);
            }
            return true;
        });

        this.registerTest('Language Sync', async () => {
            const managerLang = languageManager.getCurrentLanguage();
            if (managerLang !== 'english') {
                throw new Error(`Language mismatch: ${managerLang} vs english`);
            }
            return true;
        });

        this.registerTest('Translation Loading', async () => {
            await languageManager.initialize();
            if (!languageManager.isInitialized()) {
                throw new Error('Translations not loaded');
            }
            return true;
        });

        this.running = false;

        // Register other tests
        this.registerTests();
    }

    static getInstance() {
        if (!TestRunner.#instance) {
            TestRunner.#instance = new TestRunner();
        }
        return TestRunner.#instance;
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
            if (!counts['1'] || !counts['2'] || !counts['3'] || !counts['ready'] || !counts['overdue']) {
                throw new Error('Missing required status counts');
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
                    'ready': 4,
                    'overdue': 1
                }
            };
            
            // Zapisz testowe dane
            await chrome.storage.local.set({ leadCounts: mockData.counts });
            
            // Pobierz i sprawdź dane
            const { leadCounts } = await chrome.storage.local.get('leadCounts');
            const expectedCounts = {
                '1': 2,
                '2': 1,
                '3': 0,
                'ready': 4,
                'overdue': 1
            };
            if (leadCounts['1'] !== 2 ||
                leadCounts['2'] !== 1 ||
                leadCounts['3'] !== 0 ||
                leadCounts['ready'] !== 4 ||
                leadCounts['overdue'] !== 1) {
                throw new Error('Lead counts do not match expected values');
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

// Export both the class and singleton instance
export { TestRunner };
export default TestRunner.getInstance(); 