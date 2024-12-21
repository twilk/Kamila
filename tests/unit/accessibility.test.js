import { AccessibilityService } from '../../services/accessibility.js';
import { ThemeManager } from '../../services/theme.manager.js';
import { ThemePanel } from '../../services/theme.panel.js';
import { setupTestDOM } from '../test-utils/dom.js';

describe('AccessibilityService', () => {
    let service;
    
    beforeEach(() => {
        service = new AccessibilityService();
        document.body.innerHTML = '';
    });

    describe('Color Contrast', () => {
        test('should correctly validate WCAG AA contrast requirements', () => {
            expect(service.checkColorContrast('#000000', '#FFFFFF')).toBe(true); // Black on White
            expect(service.checkColorContrast('#777777', '#FFFFFF')).toBe(false); // Light gray on White
        });
    });

    describe('Focus Trap', () => {
        test('should trap focus within container', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <button>First</button>
                <input type="text">
                <button>Last</button>
            `;
            document.body.appendChild(container);

            const trap = service.createFocusTrap(container);
            
            const firstButton = container.querySelector('button');
            const lastButton = container.querySelectorAll('button')[1];
            
            // Symuluj Tab na ostatnim elemencie
            lastButton.focus();
            lastButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            
            expect(document.activeElement).toBe(firstButton);
            
            trap.release();
        });
    });

    describe('Announcements', () => {
        test('should create and remove announcement element', () => {
            service.announce('Test message');
            
            const announcer = document.querySelector('[role="alert"]');
            expect(announcer).toBeTruthy();
            expect(announcer.textContent).toBe('Test message');
            
            // Poczekaj na usunięcie
            jest.advanceTimersByTime(1000);
            expect(document.querySelector('[role="alert"]')).toBeFalsy();
        });
    });
});

describe('Accessibility Features', () => {
    let themeManager;
    let themePanel;
    
    beforeEach(() => {
        setupTestDOM();
        
        // Reset singleton
        ThemeManager.instance = null;
        
        // Initialize components
        themeManager = ThemeManager.getInstance();
        themePanel = new ThemePanel(themeManager);
    });
    
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });
    
    describe('ARIA Attributes', () => {
        test('should have proper ARIA roles and labels', () => {
            const panel = document.getElementById('theme-panel');
            
            expect(panel).toHaveAttribute('role', 'dialog');
            expect(panel).toHaveAttribute('aria-labelledby', 'theme-panel-title');
            expect(panel).toHaveAttribute('aria-modal', 'true');
        });
        
        test('should update ARIA hidden state when toggling panel', () => {
            const panel = document.getElementById('theme-panel');
            
            // Initially hidden
            expect(panel).toHaveAttribute('aria-hidden', 'true');
            
            // Open panel
            document.getElementById('edit-theme').click();
            expect(panel).toHaveAttribute('aria-hidden', 'false');
            
            // Close panel
            document.querySelector('.close-panel').click();
            expect(panel).toHaveAttribute('aria-hidden', 'true');
        });
    });
    
    describe('Keyboard Navigation', () => {
        test('should trap focus within panel when open', () => {
            // Open panel
            document.getElementById('edit-theme').click();
            
            const focusableElements = document.querySelectorAll('button, input');
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];
            
            // Focus last element and press Tab
            lastFocusable.focus();
            lastFocusable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            expect(document.activeElement).toBe(firstFocusable);
            
            // Focus first element and press Shift+Tab
            firstFocusable.focus();
            firstFocusable.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Tab',
                shiftKey: true 
            }));
            expect(document.activeElement).toBe(lastFocusable);
        });
        
        test('should close panel on Escape key', () => {
            // Open panel
            document.getElementById('edit-theme').click();
            
            // Press Escape
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            
            const panel = document.getElementById('theme-panel');
            expect(panel.classList.contains('show')).toBe(false);
        });
    });
    
    describe('Screen Reader Announcements', () => {
        test('should announce panel state changes', () => {
            const announceSpy = jest.spyOn(accessibilityService, 'announce');
            
            // Open panel
            document.getElementById('edit-theme').click();
            expect(announceSpy).toHaveBeenCalledWith('screenReader.panelOpened');
            
            // Close panel
            document.querySelector('.close-panel').click();
            expect(announceSpy).toHaveBeenCalledWith('screenReader.panelClosed');
        });
        
        test('should announce color changes', () => {
            const announceSpy = jest.spyOn(accessibilityService, 'announce');
            
            // Open panel and change color
            document.getElementById('edit-theme').click();
            const primaryColor = document.getElementById('primary-color');
            primaryColor.value = '#000000';
            primaryColor.dispatchEvent(new Event('change'));
            
            expect(announceSpy).toHaveBeenCalledWith(
                expect.stringContaining('colorChanged')
            );
        });
    });
}); 