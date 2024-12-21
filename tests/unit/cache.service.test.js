import { CacheService } from '../../services/cache.js';
import { CACHE_CONFIG } from '../../config/cache.config.js';
import { NotificationService } from '../../services/notification.service.js';

jest.mock('../../services/notification.service.js');

describe('CacheService', () => {
    beforeEach(() => {
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn(),
                    remove: jest.fn()
                }
            }
        };
        NotificationService.notify.mockClear();
        global.performance = {
            now: jest.fn().mockReturnValue(0)
        };
    });

    describe('size management', () => {
        test('should check data size before writing', async () => {
            const largeData = Array(1024 * 1024).fill('x').join(''); // ~1MB string
            
            await CacheService.set('test', largeData);
            
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining('too large')
                })
            );
        });

        test('should track total cache size', async () => {
            chrome.storage.local.get.mockResolvedValueOnce({
                existing: { size: 45 * 1024 * 1024 } // 45MB
            });

            const newData = 'test data';
            await CacheService.set('test', newData);

            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'warning',
                    message: expect.stringContaining('MB')
                })
            );
        });
    });

    describe('performance monitoring', () => {
        test('should monitor write time', async () => {
            global.performance.now
                .mockReturnValueOnce(0)    // start
                .mockReturnValueOnce(150); // end (150ms)

            await CacheService.set('test', 'data');

            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'warning',
                    message: expect.stringContaining('150ms')
                })
            );
        });

        test('should monitor read time', async () => {
            const consoleSpy = jest.spyOn(console, 'warn');
            global.performance.now
                .mockReturnValueOnce(0)   // start
                .mockReturnValueOnce(60); // end (60ms)

            chrome.storage.local.get.mockResolvedValueOnce({
                test: {
                    data: 'test',
                    expires: Date.now() + 1000
                }
            });

            await CacheService.get('test');

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('60ms')
            );
        });
    });

    describe('cache invalidation', () => {
        test('should randomly force refresh', async () => {
            // Mock Math.random to always return value above threshold
            const originalRandom = Math.random;
            Math.random = jest.fn().mockReturnValue(0.05); // 5%

            chrome.storage.local.get.mockResolvedValueOnce({
                test: {
                    data: 'test',
                    expires: Date.now() + 1000
                }
            });

            const result = await CacheService.get('test');
            expect(result).toBeNull();
            expect(chrome.storage.local.remove).toHaveBeenCalledWith('test');

            Math.random = originalRandom;
        });

        test('should cleanup expired entries', async () => {
            const now = Date.now();
            chrome.storage.local.get.mockResolvedValueOnce({
                expired1: { expires: now - 1000, size: 1000 },
                expired2: { expires: now - 2000, size: 2000 },
                valid: { expires: now + 1000, size: 3000 }
            });

            const removedCount = await CacheService.cleanup();

            expect(removedCount).toBe(2);
            expect(chrome.storage.local.remove).toHaveBeenCalledWith(
                ['expired1', 'expired2']
            );
        });
    });

    describe('error handling', () => {
        test('should handle storage errors gracefully', async () => {
            chrome.storage.local.set.mockRejectedValueOnce(
                new Error('Storage error')
            );

            const result = await CacheService.set('test', 'data');
            
            expect(result).toBe(false);
            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining('Storage error')
                })
            );
        });

        test('should handle data serialization errors', async () => {
            const circularData = { self: null };
            circularData.self = circularData;

            const result = await CacheService.set('test', circularData);
            
            expect(result).toBe(false);
            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining('circular')
                })
            );
        });
    });
}); 