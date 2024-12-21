import { APIService } from '../../services/api.js';
import { NotificationService } from '../../services/notification.service.js';

jest.mock('../../services/notification.service.js');

describe('APIService', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        NotificationService.notify.mockClear();
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn()
                }
            }
        };
    });

    describe('fetchOrders', () => {
        test('should notify about new orders', async () => {
            const mockOrders = [
                { id: 1, created_at: new Date().toISOString() }
            ];

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: mockOrders })
            });

            chrome.storage.local.get.mockResolvedValueOnce({
                lastOrderCheck: Date.now() - 3600000 // 1 hour ago
            });

            await APIService.fetchOrders('STORE1');

            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'info',
                    data: { orders: mockOrders }
                })
            );
        });

        test('should handle API errors', async () => {
            const error = new Error('Network error');
            global.fetch.mockRejectedValueOnce(error);

            await expect(APIService.fetchOrders('STORE1')).rejects.toThrow();

            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining('Network error')
                })
            );
        });
    });

    describe('handleStatusChange', () => {
        test('should notify on successful status change', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });

            await APIService.handleStatusChange('123', 5);

            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                    message: expect.stringContaining('123')
                })
            );
        });

        test('should handle status change errors', async () => {
            const error = new Error('Update failed');
            global.fetch.mockRejectedValueOnce(error);

            await expect(APIService.handleStatusChange('123', 5)).rejects.toThrow();

            expect(NotificationService.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining('Update failed')
                })
            );
        });
    });

    describe('checkForNewOrders', () => {
        test('should identify new orders correctly', async () => {
            const now = Date.now();
            const orders = [
                { id: 1, created_at: new Date(now).toISOString() },
                { id: 2, created_at: new Date(now - 7200000).toISOString() } // 2 hours ago
            ];

            chrome.storage.local.get.mockResolvedValueOnce({
                lastOrderCheck: now - 3600000 // 1 hour ago
            });

            const newOrders = await APIService.checkForNewOrders(orders);
            expect(newOrders).toHaveLength(1);
            expect(newOrders[0].id).toBe(1);
        });

        test('should update last check time', async () => {
            const orders = [{ id: 1, created_at: new Date().toISOString() }];

            await APIService.checkForNewOrders(orders);

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    lastOrderCheck: expect.any(Number),
                    lastOrderIds: [1]
                })
            );
        });
    });

    describe('getStatusName', () => {
        test('should return correct status names', () => {
            expect(APIService.getStatusName(1)).toBe('Złożone');
            expect(APIService.getStatusName(2)).toBe('Potwierdzone');
            expect(APIService.getStatusName(3)).toBe('Przyjęte do realizacji');
            expect(APIService.getStatusName(5)).toBe('Gotowe do odbioru');
            expect(APIService.getStatusName(999)).toBe('Nieznany');
        });
    });
}); 