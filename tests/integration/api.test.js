import { apiService } from '../../services/ApiService.js';
import { cacheService } from '../../services/CacheService.js';
import { logService } from '../../services/LogService.js';
import { requestQueueService } from '../../services/RequestQueueService.js';

describe('API Integration', () => {
    let api;
    
    beforeEach(() => {
        api = new apiService();
        cacheService.clearAll();
    });

    test('should handle full API flow', async () => {
        const result = await api.getOrderStatuses();
        expect(result.success).toBe(true);
        expect(result.statusCounts).toBeDefined();
        
        // Check cache
        const cached = await cacheService.get('orders_ALL');
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