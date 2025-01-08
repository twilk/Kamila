import { sellyApi } from '@/services/sellyApi';
import { ApiError } from '@/services/errors';

describe('SellyApiService', () => {
    beforeEach(() => {
        fetch.mockClear();
        sellyApi.cache.clear();
    });

    describe('Authentication', () => {
        test('should initialize with credentials', async () => {
            const mockCredentials = {
                apiKey: 'test-key',
                apiSecret: 'test-secret'
            };
            fetch.mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve(mockCredentials)
            }));

            await sellyApi.initialize();
            expect(sellyApi.credentials).toEqual(mockCredentials);
        });

        test('should handle initialization errors', async () => {
            fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
            await expect(sellyApi.initialize()).rejects.toThrow();
        });
    });

    describe('Order Management', () => {
        beforeEach(async () => {
            await sellyApi.initialize();
        });

        test('should fetch orders by status', async () => {
            const mockOrders = {
                total: 5,
                orders: Array(5).fill({
                    id: 1,
                    status: 'new',
                    customer: { name: 'Test', email: 'test@test.com' }
                })
            };

            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockOrders)
            }));

            const orders = await sellyApi.getLeadDetails(1);
            expect(orders).toHaveLength(5);
        });

        test('should count orders by status', async () => {
            const mockResponse = {
                total: 3,
                orders: Array(3).fill({ status: 'new' })
            };

            fetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            }));

            const counts = await sellyApi.fetchLeadCounts();
            expect(counts.submitted).toBe(3);
        });

        test('should identify overdue orders correctly', () => {
            const threeWeeksAgo = new Date();
            threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
            
            const order = { ready_date: threeWeeksAgo.toISOString() };
            expect(sellyApi.isOverdue(order)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle API errors', async () => {
            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            }));

            await expect(sellyApi.getLeadDetails(1))
                .rejects
                .toThrow(ApiError);
        });

        test('should handle network errors', async () => {
            fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
            await expect(sellyApi.getLeadDetails(1)).rejects.toThrow();
        });
    });

    describe('Caching', () => {
        test('should cache API responses', async () => {
            const mockData = { total: 1, orders: [] };
            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData)
            }));

            await sellyApi.getLeadDetails(1);
            await sellyApi.getLeadDetails(1);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        test('should invalidate cache after TTL', async () => {
            const mockData = { total: 1, orders: [] };
            fetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData)
            }));

            await sellyApi.getLeadDetails(1);
            await new Promise(resolve => setTimeout(resolve, 5100)); // TTL + 100ms
            await sellyApi.getLeadDetails(1);
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });
}); 