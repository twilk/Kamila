import { darwinApi } from '@/services/darwinApi';

describe('DARWINA.PL API Error Handling', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    test('should handle network errors', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));
        
        await expect(darwinApi.fetchLeadCounts())
            .rejects
            .toThrow('Network error');
    });

    test('should handle API errors with status codes', async () => {
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized'
        }));

        await expect(darwinApi.getLeadDetails(1))
            .rejects
            .toThrow('Błąd pobierania szczegółów zamówień');
    });

    test('should handle malformed API responses', async () => {
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(null)
        }));

        await expect(darwinApi.getProducts())
            .rejects
            .toThrow('Błąd pobierania produktów');
    });

    test('should handle rate limiting', async () => {
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests'
        }));

        await expect(darwinApi.getCustomers())
            .rejects
            .toThrow('Błąd pobierania klientów');
    });

    test('should handle severe transformation errors', async () => {
        const result = darwinApi.transformOrdersData([corruptedOrder]);
        expect(result).toEqual([{
            id: undefined,
            status: API_CONFIG.DARWINA.STATUS_CODES.UNKNOWN,
            customer: { name: undefined, email: undefined },
            items: [],
            total: undefined,
            created_at: undefined,
            modified_at: undefined
        }]);
    });
}); 