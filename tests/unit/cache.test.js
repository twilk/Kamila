import { CacheService } from '../../services/cache.js';

describe('Cache Service', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('should store and retrieve data', () => {
        const testData = { test: 'data' };
        CacheService.set('test', testData);
        
        const retrieved = CacheService.get('test');
        expect(retrieved).toEqual(testData);
    });

    test('should expire after cache duration', async () => {
        const testData = { test: 'data' };
        CacheService.set('test', testData);
        
        // Simulate time passing
        jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
        
        const retrieved = CacheService.get('test');
        expect(retrieved).toBeNull();
    });

    test('should clear specific cache', () => {
        CacheService.set('test1', { data: 1 });
        CacheService.set('test2', { data: 2 });
        
        CacheService.clear('test1');
        
        expect(CacheService.get('test1')).toBeNull();
        expect(CacheService.get('test2')).toBeDefined();
    });
});
