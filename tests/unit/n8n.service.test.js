import { N8nService } from '../../services/n8n.service';
import { API_CONFIG } from '../../config/api.config';

describe('N8nService', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    test('should retry failed requests', async () => {
        const successResponse = { ok: true, json: () => Promise.resolve({ data: 'test' }) };
        global.fetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(successResponse);

        const result = await N8nService.request('/test');
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(result).toEqual({ data: 'test' });
    });

    test('should handle API errors', async () => {
        global.fetch.mockResolvedValueOnce({ 
            ok: false, 
            status: 500 
        });

        await expect(N8nService.request('/test'))
            .rejects
            .toThrow('API error - service may be unavailable');
    });
}); 