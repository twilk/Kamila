import { APIService } from '../../services/api.js';
import { NotificationService } from '../../services/notification.service.js';
import { UserCardsService } from '../../services/user-cards.service.js';

describe('Notifications Integration', () => {
    beforeEach(() => {
        // Setup mocks
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn()
                }
            }
        };
        global.Notification = {
            permission: 'granted',
            requestPermission: jest.fn()
        };
    });

    test('should show notifications across different services', async () => {
        const notificationsSpy = jest.spyOn(NotificationService, 'notify');

        // Symuluj różne operacje
        await APIService.handleStatusChange('123', 5);
        expect(notificationsSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'success',
                title: expect.stringContaining('status')
            })
        );

        await UserCardsService.addCard({
            memberId: '456',
            firstName: 'Jan',
            lastName: 'Kowalski'
        });
        expect(notificationsSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'success',
                title: expect.stringContaining('użytkownika')
            })
        );

        // Sprawdź kolejność i typy powiadomień
        const notifications = notificationsSpy.mock.calls.map(call => call[0]);
        expect(notifications).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'success' }),
                expect.objectContaining({ type: 'success' })
            ])
        );
    });

    test('should handle notification permissions', async () => {
        global.Notification.permission = 'default';
        global.Notification.requestPermission.mockResolvedValueOnce('granted');

        await NotificationService.init();
        
        expect(global.Notification.requestPermission).toHaveBeenCalled();
        expect(chrome.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({
                notification_settings: expect.objectContaining({
                    permissionChecked: true
                })
            })
        );
    });
}); 