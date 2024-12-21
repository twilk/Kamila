import { NotificationService } from '../../services/notification.service';

describe('NotificationService', () => {
    beforeEach(() => {
        // Mock chrome.storage.local
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn()
                }
            }
        };

        // Mock window.Notification
        global.Notification = {
            permission: 'granted',
            requestPermission: jest.fn()
        };
    });

    test('should initialize with default settings', async () => {
        chrome.storage.local.get.mockResolvedValueOnce({});
        const settings = await NotificationService.getSettings();
        
        expect(settings).toEqual({
            enabled: true,
            browserNotifications: true,
            inAppNotifications: true,
            logNotifications: true,
            permissionChecked: false,
            mutedTypes: []
        });
    });

    test('should request permission if needed', async () => {
        chrome.storage.local.get.mockResolvedValueOnce({
            notification_settings: {
                enabled: true,
                permissionChecked: false
            }
        });

        Notification.requestPermission.mockResolvedValueOnce('granted');
        await NotificationService.init();

        expect(Notification.requestPermission).toHaveBeenCalled();
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            notification_settings: expect.objectContaining({
                permissionChecked: true
            })
        });
    });

    test('should show browser notification', async () => {
        const notificationSpy = jest.spyOn(global, 'Notification');
        
        await NotificationService.showBrowserNotification(
            'Test Title',
            'Test Message',
            'info'
        );

        expect(notificationSpy).toHaveBeenCalledWith('Test Title', {
            body: 'Test Message',
            icon: 'icons/info.png',
            tag: expect.stringContaining('kamila-info-'),
            requireInteraction: false
        });
    });

    test('should dispatch custom event for in-app notification', () => {
        const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
        
        NotificationService.showInAppNotification(
            'Test Title',
            'Test Message',
            'warning'
        );

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'kamila-notification',
                detail: {
                    title: 'Test Title',
                    message: 'Test Message',
                    type: 'warning'
                }
            })
        );
    });

    test('should log notifications', async () => {
        const notification = {
            title: 'Test',
            message: 'Test Message',
            type: 'info',
            timestamp: Date.now()
        };

        chrome.storage.local.get.mockResolvedValueOnce({
            notifications_info: []
        });

        await NotificationService.logNotification(notification);

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            notifications_info: [notification]
        });
    });

    test('should limit logged notifications to 100', async () => {
        const oldNotifications = Array(100).fill({
            title: 'Old',
            type: 'info'
        });

        chrome.storage.local.get.mockResolvedValueOnce({
            notifications_info: oldNotifications
        });

        const newNotification = {
            title: 'New',
            type: 'info',
            timestamp: Date.now()
        };

        await NotificationService.logNotification(newNotification);

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            notifications_info: expect.arrayContaining([newNotification])
        });

        const setCall = chrome.storage.local.set.mock.calls[0][0];
        expect(setCall.notifications_info).toHaveLength(100);
        expect(setCall.notifications_info[0]).toEqual(newNotification);
    });
}); 