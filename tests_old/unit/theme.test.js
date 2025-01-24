import { ThemeManager } from '../../services/themeManager.js';

describe('ThemeManager', () => {
    let themeManager;
    
    beforeEach(() => {
        // Clear localStorage and chrome.storage before each test
        localStorage.clear();
        chrome.storage.local.clear();
        
        themeManager = new ThemeManager();
    });
    
    test('should initialize with default light theme', async () => {
        await themeManager.initialize();
        expect(themeManager.getCurrentTheme()).toBe('light');
    });
    
    test('should toggle theme correctly', async () => {
        await themeManager.initialize();
        await themeManager.toggleTheme();
        expect(themeManager.getCurrentTheme()).toBe('dark');
        await themeManager.toggleTheme();
        expect(themeManager.getCurrentTheme()).toBe('light');
    });
    
    test('should set theme correctly', async () => {
        await themeManager.initialize();
        await themeManager.setTheme('dark');
        expect(themeManager.getCurrentTheme()).toBe('dark');
    });
    
    test('should notify listeners on theme change', async () => {
        await themeManager.initialize();
        const mockListener = jest.fn();
        themeManager.addThemeListener(mockListener);
        
        await themeManager.setTheme('dark');
        expect(mockListener).toHaveBeenCalledWith('dark');
    });
    
    test('should handle system theme preference', async () => {
        await themeManager.initialize();
        await themeManager.setUseSystemTheme(true);
        expect(themeManager.isUsingSystemTheme()).toBe(true);
    });
}); 