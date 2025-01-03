import { darwinaService } from '../../services/DarwinaService.js';
import { cacheManagerService } from '../../services/CacheManagerService.js';
import { logService } from '../../services/LogService.js';

describe('DarwinaService - Orders Tests', () => {
    const mockOrderResponse = {
        "success": true,
        "data": {
            "orders": [
                {
                    "id": "123456",
                    "status": "new",
                    "created_at": "2024-01-02T12:00:00Z",
                    "updated_at": "2024-01-02T12:00:00Z",
                    "customer": {
                        "email": "test@example.com",
                        "name": "Test Customer"
                    },
                    "items": [
                        {
                            "id": "789",
                            "name": "Test Product",
                            "quantity": 1,
                            "price": 100.00
                        }
                    ],
                    "total": 100.00,
                    "currency": "PLN",
                    "payment_status": "completed",
                    "payment_method": "card"
                }
            ],
            "meta": {
                "total": 1,
                "per_page": 10,
                "current_page": 1,
                "last_page": 1
            }
        }
    };

    beforeEach(() => {
        // Clear cache before each test
        cacheManagerService.clear();
        
        // Mock fetch
        global.fetch = jest.fn();
        
        // Reset service
        darwinaService.initialized = false;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should initialize successfully', async () => {
        await darwinaService.initialize();
        expect(darwinaService.initialized).toBe(true);
    });

    test('should fetch orders successfully', async () => {
        // Mock successful API response
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOrderResponse
        });

        const storeId = 'store123';
        const orders = await darwinaService.getOrders(storeId);

        expect(orders).toEqual(mockOrderResponse);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/orders?store=store123'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                })
            })
        );
    });

    test('should use cache for subsequent requests', async () => {
        // First request - API call
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOrderResponse
        });

        const storeId = 'store123';
        const firstResponse = await darwinaService.getOrders(storeId);
        
        // Second request - should use cache
        const secondResponse = await darwinaService.getOrders(storeId);

        expect(firstResponse).toEqual(secondResponse);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should handle API errors', async () => {
        const errorResponse = {
            success: false,
            error: {
                code: 'ERROR_CODE',
                message: 'Error message'
            }
        };

        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => errorResponse
        });

        const storeId = 'store123';
        await expect(darwinaService.getOrders(storeId)).rejects.toThrow('HTTP error! status: 400');
    });

    test('should retry failed requests', async () => {
        // First two attempts fail, third succeeds
        global.fetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockOrderResponse
            });

        const storeId = 'store123';
        const orders = await darwinaService.getOrders(storeId);

        expect(orders).toEqual(mockOrderResponse);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test('should use stale cache when all retries fail', async () => {
        // First successful request to populate cache
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOrderResponse
        });

        const storeId = 'store123';
        await darwinaService.getOrders(storeId);

        // Clear fetch mock
        global.fetch.mockClear();

        // Next request fails all retries
        global.fetch
            .mockRejectedValue(new Error('Network error'));

        // Should get stale data from cache
        const orders = await darwinaService.getOrders(storeId);
        expect(orders).toEqual(mockOrderResponse);
        expect(global.fetch).toHaveBeenCalledTimes(3); // 3 retry attempts
    });

    test('should handle timeout', async () => {
        jest.useFakeTimers();

        global.fetch.mockImplementationOnce(() => new Promise(resolve => {
            setTimeout(resolve, 6000); // Longer than our timeout
        }));

        const storeId = 'store123';
        const orderPromise = darwinaService.getOrders(storeId);

        jest.advanceTimersByTime(5100); // Just past our 5000ms timeout

        await expect(orderPromise).rejects.toThrow();

        jest.useRealTimers();
    });

    test('should validate order data structure', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOrderResponse
        });

        const storeId = 'store123';
        const orders = await darwinaService.getOrders(storeId);

        expect(orders.data.orders[0]).toMatchObject({
            id: expect.any(String),
            status: expect.any(String),
            created_at: expect.any(String),
            customer: expect.objectContaining({
                email: expect.any(String),
                name: expect.any(String)
            }),
            items: expect.arrayContaining([
                expect.objectContaining({
                    id: expect.any(String),
                    name: expect.any(String),
                    quantity: expect.any(Number),
                    price: expect.any(Number)
                })
            ]),
            total: expect.any(Number),
            currency: expect.any(String)
        });
    });
}); 