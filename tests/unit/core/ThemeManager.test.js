import { ThemeManager, themeManager } from '../../../services/core/ThemeManager.js';
import { BaseManager } from '../../../services/core/BaseManager.js';

describe('ThemeManager', () => {
    describe('Singleton Pattern', () => {
        test('should maintain a single instance', () => {
            const instance1 = ThemeManager.getInstance();
            const instance2 = ThemeManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        test('should be instance of BaseManager', () => {
            expect(themeManager).toBeInstanceOf(BaseManager);
        });
    });

    describe('Theme Operations', () => {
        beforeEach(() => {
            // Reset theme state before each test
            localStorage.clear();
            document.documentElement.className = '';
        });

        test('should set theme correctly', async () => {
            await themeManager.setTheme('dark');
            expect(document.documentElement.classList.contains('dark')).toBeTruthy();
        });

        test('should get current theme', async () => {
            await themeManager.setTheme('light');
            const currentTheme = themeManager.getCurrentTheme();
            expect(currentTheme).toBe('light');
        });

        test('should toggle theme', async () => {
            await themeManager.setTheme('light');
            await themeManager.toggleTheme();
            expect(themeManager.getCurrentTheme()).toBe('dark');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid theme gracefully', async () => {
            await expect(themeManager.setTheme('invalid_theme'))
                .rejects
                .toThrow();
        });
    });
}); 