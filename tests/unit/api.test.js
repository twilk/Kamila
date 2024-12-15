import { APIService } from '../../services/api.js';
import { CacheService } from '../../services/cache.js';

describe('API Service', () => {
    let api;
    
    beforeEach(() => {
        api = new APIService();
        CacheService.clearAll();
        
        // Mock fetch
        global.fetch = jest.fn();
    });

    test('should handle API errors gracefully', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network error'));
        
        const result = await api.getOrderStatuses();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    test('should cache successful responses', async () => {
        const mockData = { data: [], __metadata: { page_count: 1 } };
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockData)
        });

        await api.getOrderStatuses();
        const cached = await CacheService.get('orders_ALL');
        
        expect(cached).toBeDefined();
        expect(cached.success).toBe(true);
    });

    test('should use correct API parameters', async () => {
        await api.getOrderStatuses();
        
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('status_id=7,8,9,10'),
            expect.any(Object)
        );
    });

    test('should initialize API service', async () => {
        const mockCredentials = {
            DARWINA_API_KEY: 'test-key',
            DARWINA_API_BASE_URL: 'https://api.test'
        };
        
        global.getDarwinaCredentials = jest.fn().mockResolvedValue(mockCredentials);
        
        await api.init();
        expect(api.apiKey).toBe('test-key');
    });
}); 