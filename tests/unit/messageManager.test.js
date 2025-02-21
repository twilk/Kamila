import { MessageManager } from '../../services/core/MessageManager.js';
import { ErrorHandler } from '../../services/core/ErrorHandler.js';
import { languageManager } from '../../services/core/LanguageManager.js';

// Mock dependencies
jest.mock('../../services/core/ErrorHandler.js');
jest.mock('../../services/core/LanguageManager.js');

describe('MessageManager', () => {
    let messageManager;
    let mockContainer;
    const mockTranslation = 'Translated message';

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock DOM elements
        mockContainer = document.createElement('div');
        mockContainer.className = 'message-container';
        document.body.appendChild(mockContainer);

        // Initialize manager
        messageManager = MessageManager.getInstance();
        languageManager.translate.mockReset();
    });

    afterEach(() => {
        // Clean up DOM
        mockContainer.remove();
        messageManager = null;
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            const result = await messageManager.initialize();
            expect(result).toBe(true);
            expect(document.querySelector('.message-container')).toBeTruthy();
        });

        it('should handle initialization errors', async () => {
            ErrorHandler.getInstance.mockImplementation(() => {
                throw new Error('Mock error');
            });

            const result = await messageManager.initialize();
            expect(result).toBe(false);
        });
    });

    describe('message display', () => {
        beforeEach(async () => {
            await messageManager.initialize();
        });

        it('should show message with correct type and text', async () => {
            languageManager.translate.mockReturnValue(mockTranslation);

            await messageManager.showMessage({
                type: 'info',
                key: 'test.key'
            });

            const message = document.querySelector('.message.info');
            expect(message).toBeTruthy();
            expect(message.querySelector('.message-text').textContent).toBe(mockTranslation);
        });

        it('should handle different message types', async () => {
            const types = ['error', 'warning', 'info', 'success'];

            for (const type of types) {
                languageManager.translate.mockReturnValue(mockTranslation);
                await messageManager.showMessage({ type, key: 'test.key' });
                const message = document.querySelector(`.message.${type}`);
                expect(message).toBeTruthy();
                expect(message.classList.contains(type)).toBe(true);
            }
        });

        it('should auto-hide message after duration', async () => {
            jest.useFakeTimers();
            const duration = 1000;

            await messageManager.showMessage({
                type: 'info',
                key: 'test.key',
                duration
            });

            const message = document.querySelector('.message');
            expect(message).toBeTruthy();

            jest.advanceTimersByTime(duration + 100);
            expect(document.querySelector('.message')).toBeFalsy();

            jest.useRealTimers();
        });

        it('should handle message animations', async () => {
            await messageManager.showMessage({
                type: 'info',
                key: 'test.key'
            });

            const message = document.querySelector('.message');
            expect(message.classList.contains('show')).toBe(true);

            await messageManager.hideMessage(message);
            expect(message.classList.contains('hide')).toBe(true);
        });
    });

    describe('message hiding', () => {
        beforeEach(async () => {
            await messageManager.initialize();
        });

        it('should hide specific message', async () => {
            await messageManager.showMessage({
                type: 'info',
                key: 'test.key'
            });

            const message = document.querySelector('.message');
            await messageManager.hideMessage(message);
            expect(document.querySelector('.message')).toBeFalsy();
        });

        it('should hide all messages', async () => {
            // Show multiple messages
            await Promise.all([
                messageManager.showMessage({ type: 'info', key: 'test.1' }),
                messageManager.showMessage({ type: 'warning', key: 'test.2' }),
                messageManager.showMessage({ type: 'error', key: 'test.3' })
            ]);

            expect(document.querySelectorAll('.message').length).toBe(3);

            await messageManager.hideAllMessages();
            expect(document.querySelectorAll('.message').length).toBe(0);
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await messageManager.initialize();
        });

        it('should handle show message errors', async () => {
            languageManager.translate.mockImplementation(() => {
                throw new Error('Mock translation error');
            });

            await messageManager.showMessage({
                type: 'info',
                key: 'test.key'
            });

            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });

        it('should handle hide message errors', async () => {
            const mockMessage = document.createElement('div');
            mockMessage.remove(); // Make element invalid

            await messageManager.hideMessage(mockMessage);
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            await messageManager.initialize();
        });

        it('should dispose properly', async () => {
            // Show some messages
            await messageManager.showMessage({
                type: 'info',
                key: 'test.key'
            });

            await messageManager.dispose();
            expect(document.querySelector('.message-container')).toBeFalsy();
            expect(document.querySelectorAll('.message').length).toBe(0);
        });

        it('should handle dispose errors', async () => {
            const mockError = new Error('Mock dispose error');
            jest.spyOn(messageManager, 'hideAllMessages').mockRejectedValue(mockError);

            await messageManager.dispose();
            expect(ErrorHandler.getInstance().handle).toHaveBeenCalledWith(
                mockError,
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ method: 'dispose' })
            );
        });
    });

    test('should show error message', () => {
        languageManager.translate.mockReturnValue(mockTranslation);
        messageManager.showError('test.error');
        expect(languageManager.translate).toHaveBeenCalledWith('test.error');
    });

    test('should show success message', () => {
        languageManager.translate.mockReturnValue(mockTranslation);
        messageManager.showSuccess('test.success');
        expect(languageManager.translate).toHaveBeenCalledWith('test.success');
    });
}); 