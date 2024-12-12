import { ThemeManager } from '@/services/theme';
import { sendLogToPopup } from '../../config/api.js';

describe('Theme Tests', () => {
    beforeEach(() => {
        sendLogToPopup('🧪 Starting theme test', 'info');
        
        // Reset body classes
        document.body.className = '';
        
        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            clear: jest.fn()
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock
        });
    });

    test('should set light theme', () => {
        try {
            ThemeManager.setTheme('light');
            expect(document.body.classList.contains('light-theme')).toBe(true);
            expect(document.body.classList.contains('dark-theme')).toBe(false);
            sendLogToPopup('✅ Light theme test passed', 'success');
        } catch (error) {
            sendLogToPopup('❌ Light theme test failed', 'error', error.message);
            throw error;
        }
    });

    test('should set dark theme', () => {
        try {
            ThemeManager.setTheme('dark');
            expect(document.body.classList.contains('dark-theme')).toBe(true);
            expect(document.body.classList.contains('light-theme')).toBe(false);
            sendLogToPopup('✅ Dark theme test passed', 'success');
        } catch (error) {
            sendLogToPopup('❌ Dark theme test failed', 'error', error.message);
            throw error;
        }
    });
}); 