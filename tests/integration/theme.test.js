import { ThemeManager } from '../../services/theme.manager.js';
import { ThemePanel } from '../../services/theme.panel.js';
import { accessibilityService } from '../../services/accessibility.js';
import { i18n } from '../../services/i18n.js';

jest.mock('../../services/accessibility.js');
jest.mock('../../services/i18n.js');

describe('Theme System Integration', () => {
    let themeManager;
    let themePanel;
    
    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="theme-panel">
                <button class="close-panel">Close</button>
                <input type="color" id="primary-color">
                <input type="color" id="secondary-color">
                <button id="save-theme">Save</button>
                <button id="reset-theme">Reset</button>
            </div>
            <div id="theme-panel-overlay"></div>
            <button id="edit-theme">Edit Theme</button>
        `;
        
        // Reset localStorage
        localStorage.clear();
        
        // Reset singleton instance
        ThemeManager.instance = null;
        
        // Initialize components
        themeManager = ThemeManager.getInstance();
        themePanel = new ThemePanel(themeManager);
    });
    
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });
    
    describe('Theme Panel Integration', () => {
        test('should update theme when colors are saved', async () => {
            // Open panel
            document.getElementById('edit-theme').click();
            
            // Change colors
            const primaryColor = document.getElementById('primary-color');
            const secondaryColor = document.getElementById('secondary-color');
            
            primaryColor.value = '#000000';
            secondaryColor.value = '#ffffff';
            
            // Save changes
            document.getElementById('save-theme').click();
            
            // Verify state
            expect(themeManager.state.customColors).toEqual({
                primary: '#000000',
                secondary: '#ffffff'
            });
            expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#000000');
            expect(document.documentElement.style.getPropertyValue('--secondary')).toBe('#ffffff');
        });
        
        test('should reset colors when reset button clicked', () => {
            // Open panel
            document.getElementById('edit-theme').click();
            
            // Reset colors
            document.getElementById('reset-theme').click();
            
            // Verify state
            expect(themeManager.state.customColors).toEqual({
                primary: '#495057',
                secondary: '#6c757d'
            });
        });
        
        test('should close panel when theme is saved', () => {
            // Open panel
            document.getElementById('edit-theme').click();
            expect(document.getElementById('theme-panel').classList.contains('show')).toBe(true);
            
            // Save changes
            document.getElementById('save-theme').click();
            
            // Verify panel is closed
            expect(document.getElementById('theme-panel').classList.contains('show')).toBe(false);
        });
    });
    
    describe('Accessibility Integration', () => {
        test('should announce theme changes to screen readers', async () => {
            await themeManager.toggleTheme('dark');
            
            expect(accessibilityService.announce).toHaveBeenCalledWith(
                i18n.translate('screenReader.themeChanged')
            );
        });
        
        test('should announce panel state changes', () => {
            // Open panel
            document.getElementById('edit-theme').click();
            expect(accessibilityService.announce).toHaveBeenCalledWith(
                i18n.translate('screenReader.panelOpened')
            );
            
            // Close panel
            document.querySelector('.close-panel').click();
            expect(accessibilityService.announce).toHaveBeenCalledWith(
                i18n.translate('screenReader.panelClosed')
            );
        });
        
        test('should maintain focus trap in panel', () => {
            // Open panel
            document.getElementById('edit-theme').click();
            
            // Get focusable elements
            const focusableElements = document.getElementById('theme-panel')
                .querySelectorAll('button, input');
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];
            
            // Test forward trap
            lastFocusable.focus();
            lastFocusable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            expect(document.activeElement).toBe(firstFocusable);
            
            // Test backward trap
            firstFocusable.focus();
            firstFocusable.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Tab',
                shiftKey: true 
            }));
            expect(document.activeElement).toBe(lastFocusable);
        });
    });
}); 