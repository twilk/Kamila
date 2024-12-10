import { sellyApi } from '@/services/sellyApi';
import { API_CONFIG } from '@/config/api';

// Mock fetch
global.fetch = jest.fn();

describe('SellyApiService', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    test('initialize should load credentials', async () => {
        const mockCredentials = {
            apiKey: 'test-key',
            apiSecret: 'test-secret'
        };

        fetch.mockImplementationOnce(() => 
            Promise.resolve({
                json: () => Promise.resolve(mockCredentials)
            })
        );

        await sellyApi.initialize();
        expect(sellyApi.credentials).toEqual(mockCredentials);
    });

    test('getHeaders should return correct headers', () => {
        sellyApi.credentials = { apiKey: 'test-key' };
        const headers = sellyApi.getHeaders();
        
        expect(headers).toEqual({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        });
    });

    test('isOverdue should correctly identify overdue orders', () => {
        const now = new Date();
        const threeWeeksAgo = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000));
        const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const overdueOrder = { ready_date: threeWeeksAgo.toISOString() };
        const recentOrder = { ready_date: yesterday.toISOString() };

        expect(sellyApi.isOverdue(overdueOrder)).toBe(true);
        expect(sellyApi.isOverdue(recentOrder)).toBe(false);
    });
}); 