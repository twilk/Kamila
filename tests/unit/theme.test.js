import { ThemeManager } from '../../services/theme.manager.js';
import { ThemePanel } from '../../services/theme.panel.js';

describe('Theme Manager', () => {
    let themeManager;
    let themePanel;
    
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
        document.body.innerHTML = `
            <div class="custom-theme-panel">
                <input type="color" id="primary-color">
                <input type="color" id="secondary-color">
                <button id="reset-theme">Reset</button>
                <button id="save-theme">Save</button>
            </div>
            <div id="theme-panel-overlay"></div>
            <button id="edit-theme">Edit</button>
        `;
        
        themeManager = new ThemeManager();
        themePanel = new ThemePanel(themeManager);
    });
    
    describe('State Management', () => {
        test('should notify subscribers of state changes', () => {
            const mockSubscriber = jest.fn();
            themeManager.subscribe(mockSubscriber);
            
            themeManager.setState({ isPanelOpen: true });
            
            expect(mockSubscriber).toHaveBeenCalledWith(
                expect.objectContaining({ isPanelOpen: true })
            );
        });
        
        test('should handle multiple subscribers', () => {
            const mockSubscriber1 = jest.fn();
            const mockSubscriber2 = jest.fn();
            
            themeManager.subscribe(mockSubscriber1);
            themeManager.subscribe(mockSubscriber2);
            
            themeManager.setState({ currentTheme: 'dark' });
            
            expect(mockSubscriber1).toHaveBeenCalled();
            expect(mockSubscriber2).toHaveBeenCalled();
        });
    });

    describe('Theme Functionality', () => {
        test('should initialize with default theme', () => {
            expect(themeManager.state.currentTheme).toBe('light');
            expect(document.body.classList.contains('light-theme')).toBe(true);
        });

        test('should toggle theme correctly', () => {
            themeManager.toggleTheme('dark');
            expect(themeManager.state.currentTheme).toBe('dark');
            expect(document.body.classList.contains('dark-theme')).toBe(true);
            expect(localStorage.getItem('theme')).toBe('dark');
        });

        test('should handle custom theme', () => {
            const customColors = {
                primary: '#123456',
                secondary: '#654321'
            };
            themeManager.updateCustomColors(customColors);
            themeManager.toggleTheme('custom');
            
            expect(themeManager.state.currentTheme).toBe('custom');
            expect(document.body.classList.contains('custom-theme')).toBe(true);
            expect(getComputedStyle(document.documentElement).getPropertyValue('--primary')).toBe(customColors.primary);
        });
    });
});

describe('Theme Panel', () => {
    let themeManager;
    let themePanel;
    
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
        document.body.innerHTML = `
            <div class="custom-theme-panel">
                <input type="color" id="primary-color">
                <input type="color" id="secondary-color">
                <button id="reset-theme">Reset</button>
                <button id="save-theme">Save</button>
            </div>
            <div id="theme-panel-overlay"></div>
            <button id="edit-theme">Edit</button>
        `;
        
        themeManager = new ThemeManager();
        themePanel = new ThemePanel(themeManager);
    });

    describe('Panel Visibility', () => {
        test('should toggle panel visibility through state', () => {
            themePanel.handlePanelToggle();
            
            expect(themeManager.state.isPanelOpen).toBe(true);
            expect(document.querySelector('.custom-theme-panel').classList.contains('show')).toBe(true);
            
            themePanel.handlePanelToggle();
            
            expect(themeManager.state.isPanelOpen).toBe(false);
            expect(document.querySelector('.custom-theme-panel').classList.contains('show')).toBe(false);
        });
        
        test('should close panel on escape key', () => {
            themeManager.setState({ isPanelOpen: true });
            
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            
            expect(themeManager.state.isPanelOpen).toBe(false);
        });
    });

    describe('Color Management', () => {
        test('should save and load custom colors', () => {
            const customColors = {
                primary: '#123456',
                secondary: '#654321'
            };
            
            document.getElementById('primary-color').value = customColors.primary;
            document.getElementById('secondary-color').value = customColors.secondary;
            themePanel.saveColors();
            
            expect(themeManager.state.customColors).toEqual(customColors);
            expect(localStorage.getItem('customColors')).toBe(JSON.stringify(customColors));
        });

        test('should reset colors to defaults', () => {
            themePanel.resetColors();
            
            expect(document.getElementById('primary-color').value).toBe('#495057');
            expect(document.getElementById('secondary-color').value).toBe('#6c757d');
        });
    });
}); 