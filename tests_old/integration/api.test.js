import { APIService } from '../../services/api.js';
import { CacheService } from '../../services/cache.js';

describe('API Integration', () => {
    let api;
    
    beforeEach(() => {
        api = new APIService();
        CacheService.clearAll();
    });

    test('should handle full API flow', async () => {
        const result = await api.getOrderStatuses();
        expect(result.success).toBe(true);
        expect(result.statusCounts).toBeDefined();
        
        // Check cache
        const cached = await CacheService.get('orders_ALL');
        expect(cached).toBeDefined();
    });

    test('should handle API errors gracefully', async () => {
        // Force API error
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        
        const result = await api.getOrderStatuses();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
}); 