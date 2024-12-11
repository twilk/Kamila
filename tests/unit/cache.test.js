import { ApiCache } from '@/services/cache';
import { CacheManager } from '@/services/cache';

describe('Cache Service Tests', () => {
    let cache;
    const TEST_TTL = 100; // 100ms dla szybszych testów

    beforeEach(() => {
        jest.useFakeTimers();
        cache = new ApiCache(TEST_TTL);
        localStorage.clear();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Basic Operations', () => {
        test('should store and retrieve values correctly', () => {
            const testData = { id: 1, value: 'test' };
            cache.set('key1', testData);
            
            const retrieved = cache.get('key1');
            expect(retrieved).toEqual(testData);
            expect(retrieved).not.toBe(testData); // Sprawdź czy to nie ta sama referencja
        });

        test('should handle multiple values independently', () => {
            const initialSize = cache.size();
            
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            expect(cache.size()).toBe(initialSize + 2);
            expect(cache.get('key1')).toBe('value1');
            expect(cache.get('key2')).toBe('value2');
        });

        test('should return null for non-existent keys', () => {
            expect(cache.get('nonexistent')).toBeNull();
            expect(console.warn).not.toHaveBeenCalled();
        });
    });

    describe('TTL Behavior', () => {
        test('should expire items after TTL', () => {
            cache.set('key1', 'value1');
            
            // Sprawdź przed wygaśnięciem
            jest.advanceTimersByTime(TEST_TTL - 1);
            expect(cache.get('key1')).toBe('value1');
            
            // Sprawdź po wygaśnięciu
            jest.advanceTimersByTime(2);
            expect(cache.get('key1')).toBeNull();
        });

        test('should reset TTL on value update', () => {
            cache.set('key1', 'value1');
            
            // Poczekaj prawie do wygaśnięcia
            jest.advanceTimersByTime(TEST_TTL - 10);
            
            // Zaktualizuj wartość
            cache.set('key1', 'value2');
            
            // Sprawdź czy wartość nie wygasła po pierwotnym TTL
            jest.advanceTimersByTime(11);
            expect(cache.get('key1')).toBe('value2');
        });
    });

    describe('Memory Management', () => {
        test('should clear all entries', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            const initialSize = cache.size();
            expect(initialSize).toBeGreaterThan(0);
            
            cache.clear();
            expect(cache.size()).toBe(0);
            expect(cache.get('key1')).toBeNull();
            expect(cache.get('key2')).toBeNull();
        });

        test('should handle memory pressure', () => {
            // Symuluj dużą ilość danych
            const largeData = new Array(1000).fill('x').join('');
            const entries = 1000;
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Dodaj dużo danych
            for (let i = 0; i < entries; i++) {
                cache.set(`key${i}`, largeData);
            }
            
            const usedMemory = process.memoryUsage().heapUsed - initialMemory;
            console.log(`Memory used: ${usedMemory / 1024 / 1024} MB`);
            
            // Wyczyść cache
            cache.clear();
            
            // Sprawdź czy pamięć została zwolniona
            const finalMemory = process.memoryUsage().heapUsed;
            expect(finalMemory).toBeLessThan(initialMemory * 1.1); // Dopuść 10% narzutu
        });
    });

    describe('Error Handling', () => {
        test('should handle circular references', () => {
            const circular = { self: null };
            circular.self = circular;
            
            expect(() => cache.set('circular', circular)).not.toThrow();
            expect(cache.get('circular')).toEqual('[Circular Reference]');
        });

        test('should handle invalid keys', () => {
            const invalidKeys = [null, undefined, {}, [], 42];
            
            invalidKeys.forEach(key => {
                expect(() => cache.set(key, 'value')).toThrow();
                expect(() => cache.get(key)).toThrow();
            });
        });

        test('should handle concurrent operations', async () => {
            const operations = 100;
            const promises = [];
            
            // Symuluj równoczesne operacje
            for (let i = 0; i < operations; i++) {
                promises.push(
                    Promise.all([
                        Promise.resolve(cache.set(`key${i}`, `value${i}`)),
                        Promise.resolve(cache.get(`key${i}`))
                    ])
                );
            }
            
            await Promise.all(promises);
            expect(cache.size()).toBe(operations);
        });
    });
});

describe('CacheManager', () => {
    test('should initialize cache', async () => {
        const result = await CacheManager.init();
        expect(result).toBe(true);
    });

    test('should set and get data', async () => {
        const testData = { test: 'value' };
        
        // Set data
        const setResult = await CacheManager.set('test-key', testData);
        expect(setResult).toBe(true);
        
        // Get data
        const getData = CacheManager.get('test-key');
        expect(getData).toEqual(testData);
    });

    test('should handle invalid JSON data', () => {
        // Symuluj uszkodzone dane w localStorage
        localStorage.setItem('test-key', 'invalid-json');
        
        const result = CacheManager.get('test-key');
        expect(result).toBeNull();
    });

    test('should clear specific key', () => {
        // Set test data
        localStorage.setItem('key1', 'value1');
        localStorage.setItem('key2', 'value2');
        
        // Clear specific key
        const result = CacheManager.clear('key1');
        expect(result).toBe(true);
        
        // Check if only specified key was cleared
        expect(localStorage.getItem('key1')).toBeNull();
        expect(localStorage.getItem('key2')).toBe('value2');
    });

    test('should clear all data', () => {
        // Set test data
        localStorage.setItem('key1', 'value1');
        localStorage.setItem('key2', 'value2');
        
        // Clear all
        const result = CacheManager.clear();
        expect(result).toBe(true);
        
        // Check if all data was cleared
        expect(localStorage.length).toBe(0);
    });

    test('should handle errors gracefully', async () => {
        // Symuluj błąd localStorage
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = jest.fn(() => {
            throw new Error('Storage error');
        });
        
        const result = await CacheManager.set('test', { data: 'test' });
        expect(result).toBe(false);
        
        // Przywróć oryginalną funkcję
        localStorage.setItem = originalSetItem;
    });
});
