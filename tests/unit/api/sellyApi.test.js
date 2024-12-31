import { sellyService } from '../../../services/SellyService.js';
import { ApiError } from '../../../services/ErrorService.js';

describe('SellyApiService', () => {
    beforeEach(() => {
        fetch.mockClear();
        sellyService.cache.clear();
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

            await sellyService.initialize();
            expect(sellyService.credentials).toEqual(mockCredentials);
        });

        test('should handle initialization errors', async () => {
            fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
            await expect(sellyService.initialize()).rejects.toThrow();
        });
    });

    describe('Order Management', () => {
        beforeEach(async () => {
            await sellyService.initialize();
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

            const orders = await sellyService.getLeadDetails(1);
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

            const counts = await sellyService.fetchLeadCounts();
            expect(counts.submitted).toBe(3);
        });

        test('should identify overdue orders correctly', () => {
            const threeWeeksAgo = new Date();
            threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
            
            const order = { ready_date: threeWeeksAgo.toISOString() };
            expect(sellyService.isOverdue(order)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle API errors', async () => {
            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            }));

            await expect(sellyService.getLeadDetails(1))
                .rejects
                .toThrow(ApiError);
        });

        test('should handle network errors', async () => {
            fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
            await expect(sellyService.getLeadDetails(1)).rejects.toThrow();
        });
    });

    describe('Caching', () => {
        test('should cache API responses', async () => {
            const mockData = { total: 1, orders: [] };
            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData)
            }));

            await sellyService.getLeadDetails(1);
            await sellyService.getLeadDetails(1);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        test('should invalidate cache after TTL', async () => {
            const mockData = { total: 1, orders: [] };
            fetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData)
            }));

            await sellyService.getLeadDetails(1);
            await new Promise(resolve => setTimeout(resolve, 5100)); // TTL + 100ms
            await sellyService.getLeadDetails(1);
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });
}); 