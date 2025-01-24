import { OrderService } from '../../../services/api/OrderService.js';
import { API } from '../../../services/api/api.js';

jest.mock('../../../services/api/api.js');

describe('OrderService', () => {
    let orderService;

    beforeEach(() => {
        orderService = new OrderService();
        jest.clearAllMocks();
    });

    describe('Order Operations', () => {
        test('should fetch orders successfully', async () => {
            const mockOrders = [
                { id: 1, status: 'pending' },
                { id: 2, status: 'completed' }
            ];

            API.get.mockResolvedValueOnce({ data: mockOrders });

            const result = await orderService.getOrders();
            expect(result).toEqual(mockOrders);
            expect(API.get).toHaveBeenCalledWith('/orders');
        });

        test('should handle fetch orders error', async () => {
            const error = new Error('Network error');
            API.get.mockRejectedValueOnce(error);

            await expect(orderService.getOrders())
                .rejects
                .toThrow('Network error');
        });
    });

    describe('Order Status', () => {
        test('should update order status', async () => {
            const orderId = 1;
            const newStatus = 'completed';
            
            API.patch.mockResolvedValueOnce({ success: true });

            await orderService.updateOrderStatus(orderId, newStatus);
            expect(API.patch).toHaveBeenCalledWith(`/orders/${orderId}/status`, { status: newStatus });
        });
    });
}); 