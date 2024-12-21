import { RequestLimiter } from '../../services/request.limiter.js';
import { REQUEST_LIMITS } from '../../config/request.limits.js';

describe('RequestLimiter', () => {
    let limiter;
    
    beforeEach(() => {
        limiter = new RequestLimiter();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Rate Limiting', () => {
        test('should respect rate limits', async () => {
            const makeRequests = async (count) => {
                const requests = [];
                for (let i = 0; i < count; i++) {
                    requests.push(limiter.executeRequest({
                        url: '/test',
                        options: {}
                    }));
                }
                return Promise.allSettled(requests);
            };

            // Wykonaj więcej requestów niż limit na sekundę
            const results = await makeRequests(REQUEST_LIMITS.rateLimit.perSecond + 1);
            
            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            expect(succeeded).toBe(REQUEST_LIMITS.rateLimit.perSecond);
            expect(failed).toBe(1);
        });

        test('should reset counters after time period', async () => {
            // Wypełnij limit na sekundę
            await makeRequests(REQUEST_LIMITS.rateLimit.perSecond);
            
            // Przesuń czas o 1 sekundę
            jest.advanceTimersByTime(1000);
            
            // Powinno pozwolić na kolejne requesty
            const result = await limiter.executeRequest({
                url: '/test',
                options: {}
            });
            
            expect(result).toBeDefined();
        });
    });

    describe('Request Queue', () => {
        test('should process requests in priority order', async () => {
            const processed = [];
            
            // Dodaj requesty z różnymi priorytetami
            await Promise.all([
                limiter.executeRequest({
                    url: '/low',
                    priority: REQUEST_LIMITS.priority.LOW,
                    options: {
                        onComplete: () => processed.push('low')
                    }
                }),
                limiter.executeRequest({
                    url: '/high',
                    priority: REQUEST_LIMITS.priority.HIGH,
                    options: {
                        onComplete: () => processed.push('high')
                    }
                }),
                limiter.executeRequest({
                    url: '/critical',
                    priority: REQUEST_LIMITS.priority.CRITICAL,
                    options: {
                        onComplete: () => processed.push('critical')
                    }
                })
            ]);

            expect(processed).toEqual(['critical', 'high', 'low']);
        });

        test('should retry failed requests', async () => {
            let attempts = 0;
            const mockRequest = {
                url: '/test',
                options: {
                    onRequest: () => {
                        attempts++;
                        if (attempts < 3) throw new Error('Failed');
                        return 'success';
                    }
                }
            };

            const result = await limiter.addToQueueWithRetry(() => 
                limiter.executeRequest(mockRequest)
            );

            expect(attempts).toBe(3);
            expect(result).toBe('success');
        });
    });

    describe('Cache Management', () => {
        test('should cache responses', async () => {
            const mockResponse = { data: 'test' };
            const cacheKey = 'GET:/test';

            await limiter.executeRequest({
                url: '/test',
                cacheKey,
                options: {
                    onRequest: () => mockResponse
                }
            });

            const cachedResponse = limiter.getFromCache(cacheKey);
            expect(cachedResponse).toEqual(mockResponse);
        });

        test('should respect cache timeout', async () => {
            const cacheKey = 'GET:/test';
            await limiter.executeRequest({
                url: '/test',
                cacheKey,
                options: {
                    onRequest: () => ({ data: 'test' })
                }
            });

            jest.advanceTimersByTime(REQUEST_LIMITS.cache.timeout + 1000);
            
            const cachedResponse = limiter.getFromCache(cacheKey);
            expect(cachedResponse).toBeNull();
        });
    });

    describe('Performance Monitoring', () => {
        test('should track request statistics', async () => {
            await makeRequests(5);
            
            const stats = limiter.getStats();
            expect(stats.counters.second).toBe(5);
            expect(stats.queueLength).toBe(0);
            expect(stats.activeRequests).toBe(0);
        });
    });
});

// Helper function
async function makeRequests(count) {
    const requests = [];
    for (let i = 0; i < count; i++) {
        requests.push(limiter.executeRequest({
            url: '/test',
            options: {}
        }));
    }
    return Promise.allSettled(requests);
} 