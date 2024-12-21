import { NotificationCenter } from '../../components/notification-center';

describe('NotificationCenter', () => {
    let notificationCenter;

    beforeEach(() => {
        document.body.innerHTML = '';
        notificationCenter = new NotificationCenter();
    });

    test('should create container on init', () => {
        const container = document.querySelector('.notification-center');
        expect(container).toBeTruthy();
    });

    test('should show notification', () => {
        const event = new CustomEvent('kamila-notification', {
            detail: {
                title: 'Test Title',
                message: 'Test Message',
                type: 'info'
            }
        });

        window.dispatchEvent(event);

        const notification = document.querySelector('.notification');
        expect(notification).toBeTruthy();
        expect(notification.textContent).toContain('Test Title');
        expect(notification.textContent).toContain('Test Message');
    });

    test('should dismiss notification on close button click', () => {
        notificationCenter.showNotification({
            title: 'Test',
            message: 'Test'
        });

        const closeButton = document.querySelector('.notification-close');
        closeButton.click();

        // Wait for animation
        jest.advanceTimersByTime(300);

        const notification = document.querySelector('.notification');
        expect(notification).toBeFalsy();
    });

    test('should pause progress on hover', () => {
        notificationCenter.showNotification({
            title: 'Test',
            message: 'Test'
        });

        const notification = document.querySelector('.notification');
        const progress = notification.querySelector('.notification-progress');

        notification.dispatchEvent(new MouseEvent('mouseenter'));
        expect(progress.style.animationPlayState).toBe('paused');

        notification.dispatchEvent(new MouseEvent('mouseleave'));
        expect(progress.style.animationPlayState).toBe('running');
    });
}); 