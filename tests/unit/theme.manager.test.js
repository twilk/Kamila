import { ThemeManager } from '../../services/theme.manager.js';
import { accessibilityService } from '../../services/accessibility.js';
import { i18n } from '../../services/i18n.js';
import { PerformanceMonitor } from '../../services/performance.js';
import { apiService } from '../../services/api.service.js';

jest.mock('../../services/accessibility.js');
jest.mock('../../services/i18n.js');
jest.mock('../../services/performance.js');
jest.mock('../../services/api.service.js');

describe('ThemeManager', () => {
    let themeManager;
    
    beforeEach(() => {
        // Reset localStorage
        localStorage.clear();
        
        // Reset singleton instance
        ThemeManager.instance = null;
        
        // Reset DOM
        document.body.className = '';
        document.documentElement.style.cssText = '';
        
        // Mock services
        i18n.translate = jest.fn(key => key);
        accessibilityService.announce = jest.fn();
        PerformanceMonitor.prototype.batchDOMUpdates = jest.fn(async (fn) => fn());
        PerformanceMonitor.prototype.optimizeStorageOperation = jest.fn(async (fn) => fn());
        apiService.backgroundRequest = jest.fn();
        apiService.request = jest.fn();
        
        // Create new instance
        themeManager = ThemeManager.getInstance();
        
        document.body.innerHTML = `
            <div id="theme-panel">...</div>
        `;
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Singleton Pattern', () => {
        test('should always return the same instance', () => {
            const instance1 = ThemeManager.getInstance();
            const instance2 = ThemeManager.getInstance();
            expect(instance1).toBe(instance2);
        });
        
        test('should not create new instance with constructor', () => {
            const instance1 = ThemeManager.getInstance();
            const instance2 = new ThemeManager();
            expect(instance1).toBe(instance2);
        });
    });
    
    describe('State Management', () => {
        test('should notify subscribers when state changes', () => {
            const callback = jest.fn();
            themeManager.subscribe(callback);
            themeManager.setState({ currentTheme: 'dark' });
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                currentTheme: 'dark'
            }));
        });
        
        test('should handle subscriber errors gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            themeManager.subscribe(() => {
                throw new Error('Subscriber error');
            });
            
            themeManager.setState({ currentTheme: 'dark' });
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error in theme subscriber callback:',
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });
    });
    
    describe('Theme Operations', () => {
        test('should toggle theme with performance optimization', async () => {
            await themeManager.toggleTheme('dark');
            
            expect(PerformanceMonitor.prototype.batchDOMUpdates).toHaveBeenCalled();
            expect(PerformanceMonitor.prototype.optimizeStorageOperation).toHaveBeenCalled();
            expect(document.body.classList.contains('dark-theme')).toBe(true);
        });
        
        test('should sync theme with server', async () => {
            await themeManager.toggleTheme('dark', true);
            
            expect(apiService.backgroundRequest).toHaveBeenCalledWith(expect.objectContaining({
                endpoint: '/theme/sync',
                method: 'POST',
                data: expect.objectContaining({
                    theme: 'dark'
                })
            }));
        });
        
        test('should handle server sync errors gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            apiService.backgroundRequest.mockRejectedValueOnce(new Error('Sync failed'));
            
            await themeManager.toggleTheme('dark', true);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Theme sync failed:',
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });
    });
    
    describe('Custom Colors', () => {
        test('should update custom colors with performance monitoring', async () => {
            const colors = { primary: '#000000', secondary: '#ffffff' };
            
            await themeManager.updateCustomColors(colors);
            
            expect(PerformanceMonitor.prototype.optimizeStorageOperation).toHaveBeenCalled();
            expect(localStorage.getItem('customColors')).toBe(JSON.stringify(colors));
        });
        
        test('should apply custom colors to CSS variables', async () => {
            const colors = { primary: '#000000', secondary: '#ffffff' };
            themeManager.state.currentTheme = 'custom';
            
            await themeManager.updateCustomColors(colors);
            
            expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#000000');
            expect(document.documentElement.style.getPropertyValue('--secondary')).toBe('#ffffff');
        });
    });
    
    describe('Error Handling', () => {
        test('should handle localStorage errors in getInitialTheme', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            localStorage.getItem = jest.fn(() => { throw new Error('Storage error'); });
            
            const theme = themeManager.getInitialTheme();
            
            expect(theme).toBe('light');
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to get theme from localStorage:',
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });
        
        test('should handle JSON parse errors in getInitialColors', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            localStorage.getItem = jest.fn(() => 'invalid json');
            
            const colors = themeManager.getInitialColors();
            
            expect(colors).toEqual({
                primary: '#495057',
                secondary: '#6c757d'
            });
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to get colors from localStorage:',
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });
    });
}); 