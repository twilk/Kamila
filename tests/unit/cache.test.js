import { cacheService } from '../../services/CacheService.js';
import { logService } from '../../services/LogService.js';

describe('Cache Service', () => {
    beforeEach(async () => {
        await cacheService.clearAll();
    });

    it('powinno zapisywać i odczytywać dane', async () => {
        const testData = { test: 'data' };
        await cacheService.set('test-key', testData);
        const result = await cacheService.get('test-key');
        expect(result).toEqual(testData);
    });

    it('powinno zwracać null dla nieistniejących danych', async () => {
        const result = await cacheService.get('nonexistent-key');
        expect(result).toBeNull();
    });

    it('powinno czyścić pojedynczy klucz', async () => {
        await cacheService.set('test-key', { test: 'data' });
        await cacheService.clear('test-key');
        const result = await cacheService.get('test-key');
        expect(result).toBeNull();
    });

    it('powinno czyścić wszystkie dane', async () => {
        await cacheService.set('key1', 'data1');
        await cacheService.set('key2', 'data2');
        await cacheService.clearAll();
        
        const result1 = await cacheService.get('key1');
        const result2 = await cacheService.get('key2');
        
        expect(result1).toBeNull();
        expect(result2).toBeNull();
    });

    it('powinno sprawdzać dostępność cache', async () => {
        const isAvailable = await cacheService.isAvailable();
        expect(isAvailable).toBe(true);
    });
});
