import { themeService } from '../../services/ThemeService.js';
import { logService } from '../../services/LogService.js';

describe('Theme Service', () => {
    let themeService;
    
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
        themeService = new ThemeService();
    });

    test('should initialize with default theme', () => {
        expect(themeService.getCurrentTheme()).toBe('light');
        expect(document.body.classList.contains('light-theme')).toBe(true);
    });

    test('should toggle theme correctly', () => {
        const newTheme = themeService.toggleTheme();
        expect(newTheme).toBe('dark');
        expect(document.body.classList.contains('dark-theme')).toBe(true);
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('should apply specific theme', () => {
        themeService.applyTheme('dark');
        expect(themeService.getCurrentTheme()).toBe('dark');
        expect(document.body.classList.contains('dark-theme')).toBe(true);
    });
}); 