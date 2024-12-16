import { CacheService } from '../../services/cache.js';

describe('Cache Service', () => {
    beforeEach(async () => {
        await CacheService.clearAll();
    });

    it('powinno zapisywać i odczytywać dane', async () => {
        const testData = { test: 'data' };
        await CacheService.set('test-key', testData);
        const result = await CacheService.get('test-key');
        expect(result).toEqual(testData);
    });

    it('powinno zwracać null dla nieistniejących danych', async () => {
        const result = await CacheService.get('nonexistent-key');
        expect(result).toBeNull();
    });

    it('powinno czyścić pojedynczy klucz', async () => {
        await CacheService.set('test-key', { test: 'data' });
        await CacheService.clear('test-key');
        const result = await CacheService.get('test-key');
        expect(result).toBeNull();
    });

    it('powinno czyścić wszystkie dane', async () => {
        await CacheService.set('key1', 'data1');
        await CacheService.set('key2', 'data2');
        await CacheService.clearAll();
        
        const result1 = await CacheService.get('key1');
        const result2 = await CacheService.get('key2');
        
        expect(result1).toBeNull();
        expect(result2).toBeNull();
    });

    it('powinno sprawdzać dostępność cache', async () => {
        const isAvailable = await CacheService.isAvailable();
        expect(isAvailable).toBe(true);
    });
});
