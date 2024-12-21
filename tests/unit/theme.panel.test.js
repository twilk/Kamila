import { ThemePanel } from '../../services/theme.panel.js';
import { ThemeManager } from '../../services/theme.manager.js';
import { accessibilityService } from '../../services/accessibility.js';
import { i18n } from '../../services/i18n.js';
import { AnimationMonitor } from '../../services/animation.monitor.js';
import { AnimationOptimizer } from '../../services/animation.optimizer.js';

jest.mock('../../services/accessibility.js');
jest.mock('../../services/i18n.js');
jest.mock('../../services/animation.monitor.js');
jest.mock('../../services/animation.optimizer.js');

describe('ThemePanel', () => {
    let themePanel;
    let themeManager;
    let mockElements;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="theme-panel">
                <button class="close-panel">Close</button>
                <input type="color" id="primary-color">
                <input type="color" id="secondary-color">
                <button id="save-theme">Save</button>
                <button id="reset-theme">Reset</button>
            </div>
            <div id="theme-panel-overlay"></div>
        `;
        
        themeManager = ThemeManager.getInstance();
        themePanel = new ThemePanel(themeManager);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        jest.useRealTimers();
        ThemeManager.instance = null;
    });

    describe('Initialization', () => {
        test('should setup accessibility observer', () => {
            expect(accessibilityService.observe).toHaveBeenCalled();
        });

        test('should initialize with default colors', () => {
            expect(mockElements.primaryColor.value).toBe('#495057');
            expect(mockElements.secondaryColor.value).toBe('#6c757d');
        });
    });

    describe('Panel Interactions', () => {
        test('should handle panel toggle', () => {
            themePanel.handlePanelToggle();

            expect(AnimationMonitor.prototype.startMonitoring).toHaveBeenCalled();
            
            jest.advanceTimersByTime(300);
            
            expect(AnimationMonitor.prototype.stopMonitoring).toHaveBeenCalled();
            expect(AnimationOptimizer.prototype.optimizeAnimation).toHaveBeenCalledTimes(2);
        });

        test('should handle Escape key when panel is open', () => {
            themeManager.setState({ isPanelOpen: true });
            
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            
            expect(themeManager.state.isPanelOpen).toBe(false);
            expect(accessibilityService.announce).toHaveBeenCalledWith('screenReader.panelClosed');
        });
    });

    describe('Color Management', () => {
        test('should validate contrast before saving colors', () => {
            mockElements.primaryColor.value = '#000000';
            mockElements.secondaryColor.value = '#FFFFFF';

            themePanel.saveColors();

            expect(accessibilityService.checkColorContrast)
                .toHaveBeenCalledWith('#000000', '#FFFFFF');
            expect(accessibilityService.announce)
                .toHaveBeenCalledWith('customTheme.saved');
        });

        test('should prevent saving invalid contrast colors', () => {
            accessibilityService.checkColorContrast.mockReturnValueOnce(false);
            
            mockElements.primaryColor.value = '#777777';
            mockElements.secondaryColor.value = '#888888';

            themePanel.saveColors();

            expect(accessibilityService.announce)
                .toHaveBeenCalledWith('errors.insufficientContrast');
        });

        test('should announce color changes', () => {
            mockElements.primaryColor.dispatchEvent(new Event('change'));
            
            expect(accessibilityService.announce).toHaveBeenCalled();
        });
    });

    describe('Accessibility Features', () => {
        test('should handle reduced motion preference', () => {
            themePanel.handleAccessibilityChange({ reducedMotion: true });

            expect(mockElements.panel.classList.contains('reduce-motion')).toBe(true);
            expect(mockElements.overlay.classList.contains('reduce-motion')).toBe(true);
        });

        test('should manage focus trap on panel state change', () => {
            themeManager.setState({ isPanelOpen: true });

            expect(accessibilityService.createFocusTrap)
                .toHaveBeenCalledWith(mockElements.panel);
            expect(accessibilityService.announce)
                .toHaveBeenCalledWith('screenReader.panelOpened');

            themeManager.setState({ isPanelOpen: false });

            expect(accessibilityService.announce)
                .toHaveBeenCalledWith('screenReader.panelClosed');
        });
    });

    describe('Theme Changes', () => {
        test('should announce theme changes', () => {
            themeManager.toggleTheme('dark');
            
            expect(accessibilityService.announce)
                .toHaveBeenCalledWith(i18n.translate('screenReader.themeChanged'));
        });
    });
}); 