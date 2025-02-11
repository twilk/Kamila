import { APIManager } from '../../../services/api/index.js';
import { OrderService } from '../../../services/api/OrderService.js';
import { ErrorType, ErrorSeverity } from '../../../services/core/ErrorTypes.js';

describe('OrderService', () => {
    let orderService;
    let apiManager;

    beforeEach(() => {
        apiManager = APIManager.getInstance();
        orderService = new OrderService();
    });

    describe('Order Operations', () => {
        test('should fetch orders successfully', async () => {
            const mockOrders = [
                { id: 1, status: 'pending' },
                { id: 2, status: 'completed' }
            ];

            apiManager.get.mockResolvedValueOnce({ data: mockOrders });

            const result = await orderService.getOrders();
            expect(result).toEqual(mockOrders);
            expect(apiManager.get).toHaveBeenCalledWith('/orders');
        });

        test('should handle fetch orders error', async () => {
            const error = new Error('Network error');
            apiManager.get.mockRejectedValueOnce(error);

            await expect(orderService.getOrders())
                .rejects
                .toThrow('Network error');
        });
    });

    describe('Order Status', () => {
        test('should update order status', async () => {
            const orderId = 1;
            const newStatus = 'completed';
            
            apiManager.patch.mockResolvedValueOnce({ success: true });

            await orderService.updateOrderStatus(orderId, newStatus);
            expect(apiManager.patch).toHaveBeenCalledWith(`/orders/${orderId}/status`, { status: newStatus });
        });
    });
}); 