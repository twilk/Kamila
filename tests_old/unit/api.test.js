import { APIService } from '../../services/api.js';
import { CacheService } from '../../services/cache.js';

describe('API Service', () => {
    let api;

    beforeEach(async () => {
        api = new APIService();
        await CacheService.clearAll();
    });

    describe('Inicjalizacja', () => {
        it('powinno zainicjalizować API bez błędów', async () => {
            await api.init();
            expect(api.baseUrl).toBeDefined();
            expect(api.apiKey).toBeDefined();
        });
    });

    describe('Pobieranie zamówień', () => {
        beforeEach(async () => {
            await api.init();
        });

        it('powinno pobrać zamówienia dla wszystkich sklepów', async () => {
            const result = await api.getOrderStatuses();
            expect(result.success).toBe(true);
            expect(result.statusCounts).toBeDefined();
            expect(Object.keys(result.statusCounts)).toContain('1');
            expect(Object.keys(result.statusCounts)).toContain('2');
            expect(Object.keys(result.statusCounts)).toContain('3');
        });

        it('powinno pobrać zamówienia dla konkretnego sklepu', async () => {
            const result = await api.getOrderStatuses('FRA-1');
            expect(result.success).toBe(true);
            expect(result.statusCounts).toBeDefined();
        });
    });

    describe('Cache', () => {
        beforeEach(async () => {
            await api.init();
        });

        it('powinno zapisywać i odczytywać dane z cache', async () => {
            const firstResult = await api.getOrderStatuses();
            expect(firstResult.success).toBe(true);

            const cachedData = await CacheService.get('orders_ALL');
            expect(cachedData).toBeDefined();
            expect(cachedData).toEqual(firstResult);

            const secondResult = await api.getOrderStatuses();
            expect(secondResult).toEqual(firstResult);
        });

        it('powinno respektować czas życia cache', async () => {
            const testData = { success: true, statusCounts: { '1': 5 } };
            await CacheService.set('orders_ALL', testData);
            
            const cachedData = await CacheService.get('orders_ALL');
            expect(cachedData).toEqual(testData);

            jest.advanceTimersByTime(5 * 60 * 1000);

            const expiredData = await CacheService.get('orders_ALL');
            expect(expiredData).toBeNull();
        });
    });

    describe('UI Updates', () => {
        beforeEach(async () => {
            await api.init();
            document.body.innerHTML = `
                <div class="lead-status">
                    <span class="lead-count" id="count-1">-</span>
                    <span class="lead-count" id="count-2">-</span>
                    <span class="lead-count" id="count-3">-</span>
                </div>
            `;
        });

        it('powinno aktualizować liczniki w UI', async () => {
            const result = await api.getOrderStatuses();
            expect(result.success).toBe(true);

            for (const [status, count] of Object.entries(result.statusCounts)) {
                const counter = document.getElementById(`count-${status}`);
                if (counter) {
                    expect(counter.textContent).not.toBe('-');
                    expect(counter.textContent).toBe(count.toString());
                }
            }
        });
    });
}); 