import { RequestLimiter } from '../../services/request.limiter.js';
import { ApiService } from '../../services/api.service.js';
import { REQUEST_LIMITS } from '../../config/request.limits.js';

describe('Request Limiter Integration', () => {
    let limiter;
    let apiService;
    
    beforeEach(() => {
        limiter = new RequestLimiter();
        apiService = new ApiService();
        jest.useFakeTimers();
        
        // Mock fetch API
        global.fetch = jest.fn();
    });
    
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('API Service Integration', () => {
        test('should handle concurrent requests properly', async () => {
            // Mock successful response
            global.fetch.mockImplementation(() => 
                Promise.resolve({
                    json: () => Promise.resolve({ data: 'test' })
                })
            );

            // Wykonaj wiele równoczesnych requestów
            const requests = Array(5).fill().map((_, i) => 
                apiService.request({
                    endpoint: `/test${i}`,
                    priority: i % 2 ? REQUEST_LIMITS.priority.HIGH : REQUEST_LIMITS.priority.LOW
                })
            );

            const results = await Promise.all(requests);
            
            // Sprawdź czy wszystkie requesty się powiodły
            expect(results.every(r => r.data === 'test')).toBe(true);
            
            // Sprawdź czy limiter prawidłowo śledzi requesty
            const stats = limiter.getStats();
            expect(stats.counters.second).toBe(5);
        });

        test('should handle rate limit exceeded scenario', async () => {
            // Ustaw mock dla przekroczenia limitu
            const errorResponse = {
                status: 429,
                json: () => Promise.resolve({ 
                    error: 'Rate limit exceeded',
                    retryAfter: 1000
                })
            };
            
            global.fetch
                .mockImplementationOnce(() => Promise.resolve(errorResponse))
                .mockImplementationOnce(() => Promise.resolve({
                    json: () => Promise.resolve({ data: 'success' })
                }));

            const result = await apiService.request({
                endpoint: '/test',
                priority: REQUEST_LIMITS.priority.HIGH
            });

            // Sprawdź czy request zosta�� ponowiony i zakończył się sukcesem
            expect(result.data).toBe('success');
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        test('should use cache for identical requests', async () => {
            global.fetch.mockImplementation(() => 
                Promise.resolve({
                    json: () => Promise.resolve({ data: 'cached' })
                })
            );

            // Wykonaj ten sam request dwukrotnie
            await apiService.request({
                endpoint: '/test',
                useCache: true
            });

            await apiService.request({
                endpoint: '/test',
                useCache: true
            });

            // Sprawdź czy fetch został wywołany tylko raz
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors gracefully', async () => {
            global.fetch.mockImplementation(() => 
                Promise.reject(new Error('Network error'))
            );

            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

            // Wykonaj request w tle, który powinien cicho zawieść
            const result = await apiService.backgroundRequest({
                endpoint: '/test'
            });

            expect(result).toBeNull();
            expect(consoleWarn).toHaveBeenCalled();
            
            consoleWarn.mockRestore();
        });

        test('should handle timeout properly', async () => {
            jest.useFakeTimers();
            
            global.fetch.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 35000))
            );

            const requestPromise = apiService.request({
                endpoint: '/test',
                timeout: 30000
            });

            jest.advanceTimersByTime(31000);

            await expect(requestPromise).rejects.toThrow('Request timeout');
        });
    });

    describe('Queue Management', () => {
        test('should maintain proper queue order with priorities', async () => {
            const order = [];
            
            global.fetch.mockImplementation(() => {
                return Promise.resolve({
                    json: () => {
                        const priority = global.fetch.mock.calls[order.length][1]
                            .headers['X-Request-Priority'];
                        order.push(priority);
                        return Promise.resolve({ priority });
                    }
                });
            });

            // Dodaj requesty z ró��nymi priorytetami
            await Promise.all([
                apiService.request({ endpoint: '/low', priority: REQUEST_LIMITS.priority.LOW }),
                apiService.criticalRequest({ endpoint: '/critical' }),
                apiService.request({ endpoint: '/medium' })
            ]);

            // Sprawdź kolejność wykonania
            expect(order).toEqual(['CRITICAL', 'MEDIUM', 'LOW']);
        });
    });
}); 