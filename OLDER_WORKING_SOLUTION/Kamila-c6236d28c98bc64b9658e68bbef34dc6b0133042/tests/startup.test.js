import { darwinApi } from '../src/services/darwinApi';
import { StatusChecker } from '../src/services/statusChecker';

describe('Application Startup', () => {
    beforeAll(() => {
        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        
        // Mock fetch
        global.fetch = jest.fn();
    });

    test('should initialize Darwin API', async () => {
        const mockCredentials = {
            apiKey: 'test-key',
            apiSecret: 'test-secret'
        };

        fetch.mockImplementationOnce(() => 
            Promise.resolve({
                json: () => Promise.resolve(mockCredentials)
            })
        );

        await darwinApi.initialize();
        expect(darwinApi.credentials).toEqual(mockCredentials);
    });

    test('should run status checks', async () => {
        const statusChecker = new StatusChecker(darwinApi);
        const results = await statusChecker.runTests();

        expect(results).toHaveProperty('API');
        expect(results).toHaveProperty('AUTH');
        expect(results).toHaveProperty('ORDERS');
        expect(results).toHaveProperty('CACHE');
    });

    test('should load translations', async () => {
        fetch.mockImplementationOnce(() => 
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    welcome: 'Test welcome message'
                })
            })
        );

        const response = await fetch('locales/polish.json');
        const translations = await response.json();
        
        expect(translations).toHaveProperty('welcome');
    });
}); 