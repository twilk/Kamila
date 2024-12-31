import { darwinaService } from '../../services/DarwinaService.js';
import { logService } from '../../services/LogService.js';
import { API_CONFIG } from '../../config/api.js';

describe('Extended Darwin API Error Handling', () => {
    beforeEach(() => {
        fetch.mockClear();
        darwinaService.cache.clear();
    });

    test('should handle authentication errors', async () => {
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized'
        }));

        await expect(darwinaService.initialize())
            .rejects
            .toThrow('Nie można załadować danych uwierzytelniających');
    });

    test('should handle rate limiting with retry', async () => {
        let attempts = 0;
        fetch.mockImplementation(() => {
            attempts++;
            if (attempts < 3) {
                return Promise.resolve({
                    ok: false,
                    status: 429,
                    statusText: 'Too Many Requests'
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ orders: [] })
            });
        });

        const result = await darwinaService.getLeadDetails(
            API_CONFIG.DARWIN.STATUS_CODES.SUBMITTED.id
        );
        expect(attempts).toBe(3);
        expect(result).toEqual([]);
    });

    test('should handle malformed response data', async () => {
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                orders: 'not an array' // nieprawidłowy format
            })
        }));

        await expect(darwinaService.getLeadDetails(1))
            .rejects
            .toThrow();
    });

    test('should handle network timeouts', async () => {
        fetch.mockImplementationOnce(() => new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        }));

        await expect(darwinaService.fetchLeadCounts())
            .rejects
            .toThrow();
    });
}); 