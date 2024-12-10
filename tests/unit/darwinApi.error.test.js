import { darwinApi } from '@/services/darwinApi';

describe('Darwin API Error Handling', () => {
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
}); 