import { statusCheckerService } from '../../services/StatusCheckerService.js';
import { darwinaService } from '../../services/DarwinaService.js';
import { logService } from '../../services/LogService.js';

describe('Extended Status Checker Tests', () => {
    let statusChecker;
    let mockElement;

    beforeEach(() => {
        statusChecker = new statusCheckerService(darwinaService);
        mockElement = document.createElement('div');
        mockElement.id = 'api-status';
        document.body.appendChild(mockElement);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('should run all tests sequentially', async () => {
        const testResults = [];
        
        statusChecker.tests.forEach(test => {
            jest.spyOn(test, 'test').mockImplementation(async () => {
                testResults.push(test.name);
                return true;
            });
        });

        await statusChecker.runTests();
        
        expect(testResults.length).toBe(statusChecker.tests.length);
        expect(testResults).toEqual(expect.arrayContaining(['API', 'AUTH', 'ORDERS', 'CACHE']));
    });

    test('should handle test failures gracefully', async () => {
        jest.spyOn(statusChecker.tests[0], 'test').mockRejectedValue(new Error('Test error'));
        
        const results = await statusChecker.runTests();
        expect(results[statusChecker.tests[0].name]).toBe('red');
    });

    test('should update UI during testing', async () => {
        const updateSpy = jest.spyOn(statusChecker, 'updateStatus');
        
        await statusChecker.runTests();
        
        // Powinno być wywołane co najmniej 2 razy dla każdego testu:
        // - raz na początku (testing)
        // - raz na końcu (wynik)
        expect(updateSpy).toHaveBeenCalledTimes(statusChecker.tests.length * 2);
    });

    test('should respect testing delay', async () => {
        jest.useFakeTimers();
        const runPromise = statusChecker.runTests();
        
        // Sprawdź czy timer został ustawiony
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
        
        // Przesuń wszystkie timery
        jest.runAllTimers();
        await runPromise;
        
        jest.useRealTimers();
    });

    test('should validate API health check', async () => {
        const mockResponse = { status: 'healthy' };
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        }));

        const result = await statusChecker.testApiConnection();
        expect(result).toBe(true);
    });

    test('should validate authentication', async () => {
        const mockHeaders = { Authorization: 'Bearer test-token' };
        jest.spyOn(darwinaService, 'getHeaders').mockReturnValue(mockHeaders);

        const result = await statusChecker.testAuthentication();
        expect(result).toBe(true);
    });

    test('should handle missing DOM elements', async () => {
        document.body.innerHTML = ''; // usuń wszystkie elementy
        const results = await statusChecker.runTests();
        expect(results).toBeDefined();
    });

    test('should handle concurrent test runs', async () => {
        const promise1 = statusChecker.runTests();
        const promise2 = statusChecker.runTests();
        
        const [results1, results2] = await Promise.all([promise1, promise2]);
        expect(results1).toBeDefined();
        expect(results2).toBeDefined();
    });

    test('should handle status update errors', async () => {
        // Symuluj błąd DOM
        document.getElementById = jest.fn(() => null);
        
        const results = { API: 'green' };
        statusChecker.updateStatus(results);
        
        expect(console.error).toHaveBeenCalled();
    });

    test('should handle DOM mutation during status update', async () => {
        // Symuluj usunięcie elementu podczas aktualizacji
        let called = false;
        document.getElementById = jest.fn(() => {
            if (!called) {
                called = true;
                return document.createElement('div');
            }
            return null;
        });

        const results = { API: 'green', AUTH: 'yellow' };
        statusChecker.updateStatus(results);
        
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    test('should handle invalid status values', async () => {
        const invalidResults = {
            API: 'invalid-status',
            AUTH: undefined,
            ORDERS: null
        };

        statusChecker.updateStatus(invalidResults);
        const element = document.getElementById('api-status');
        expect(element.className).toContain('status-red');
    });
}); 