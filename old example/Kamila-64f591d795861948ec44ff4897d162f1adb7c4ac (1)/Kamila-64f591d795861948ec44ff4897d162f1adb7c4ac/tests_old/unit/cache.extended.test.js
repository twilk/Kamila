import { ApiCache } from '@/services/cache';

describe('Extended Cache Tests', () => {
    let cache;
    
    beforeEach(() => {
        jest.useFakeTimers();
        cache = new ApiCache(1000); // 1 second TTL for testing
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should handle complex objects', () => {
        const complexData = {
            nested: { data: [1, 2, 3] },
            date: new Date(),
            func: () => {}
        };

        cache.set('complex', complexData);
        expect(cache.get('complex')).toEqual(complexData);
    });

    test('should handle multiple operations', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.invalidate('key1');
        
        expect(cache.get('key1')).toBeNull();
        expect(cache.get('key2')).toBe('value2');
    });

    test('should handle concurrent access', () => {
        const operations = Array(1000).fill().map((_, i) => {
            if (i % 2 === 0) {
                cache.set(`key${i}`, `value${i}`);
                return cache.get(`key${i}`);
            } else {
                return cache.get(`key${i-1}`);
            }
        });

        expect(operations.filter(Boolean).length).toBeGreaterThan(0);
    });

    test('should cleanup expired items', () => {
        cache.set('test1', 'value1');
        cache.set('test2', 'value2');
        
        jest.advanceTimersByTime(1500); // Advance past TTL
        
        expect(cache.get('test1')).toBeNull();
        expect(cache.get('test2')).toBeNull();
    });
}); 