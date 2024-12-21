import { ACCESSIBILITY_CONFIG } from '../config/theme.js';

/**
 * Serwis do zarządzania dostępnością
 */
export class AccessibilityService {
    constructor() {
        this.observers = new Set();
        this.state = {
            reducedMotion: this.checkReducedMotion(),
            highContrast: this.checkHighContrast()
        };
        
        this.initMediaQueryListeners();
    }
    
    /**
     * Inicjalizuje nasłuchiwanie zmian preferencji dostępności
     */
    initMediaQueryListeners() {
        // Reduced Motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        motionQuery.addEventListener('change', () => {
            this.state.reducedMotion = this.checkReducedMotion();
            this.notifyObservers();
        });
        
        // High Contrast
        const contrastQuery = window.matchMedia('(prefers-contrast: more)');
        contrastQuery.addEventListener('change', () => {
            this.state.highContrast = this.checkHighContrast();
            this.notifyObservers();
        });
    }
    
    /**
     * Sprawdza czy użytkownik preferuje zredukowany ruch
     */
    checkReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    
    /**
     * Sprawdza czy użytkownik preferuje wysoki kontrast
     */
    checkHighContrast() {
        return window.matchMedia('(prefers-contrast: more)').matches;
    }
    
    /**
     * Sprawdza kontrast między kolorami
     */
    checkColorContrast(color1, color2) {
        const l1 = this.getRelativeLuminance(color1);
        const l2 = this.getRelativeLuminance(color2);
        
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        return ratio >= ACCESSIBILITY_CONFIG.minContrast;
    }
    
    /**
     * Oblicza względną luminancję koloru
     */
    getRelativeLuminance(color) {
        const rgb = this.hexToRgb(color);
        const [r, g, b] = rgb.map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    
    /**
     * Konwertuje kolor HEX na RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    }
    
    /**
     * Tworzy pułapkę fokusa dla kontenera
     */
    createFocusTrap(container) {
        const focusableElements = container.querySelectorAll(
            'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        const handleFocusTrap = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };
        
        container.addEventListener('keydown', handleFocusTrap);
        
        return {
            release: () => container.removeEventListener('keydown', handleFocusTrap)
        };
    }
    
    /**
     * Ogłasza komunikat dla czytników ekranu
     */
    announce(message) {
        const announcer = document.createElement('div');
        announcer.setAttribute('role', 'alert');
        announcer.setAttribute('aria-live', 'polite');
        announcer.style.position = 'absolute';
        announcer.style.width = '1px';
        announcer.style.height = '1px';
        announcer.style.padding = '0';
        announcer.style.margin = '-1px';
        announcer.style.overflow = 'hidden';
        announcer.style.clip = 'rect(0, 0, 0, 0)';
        announcer.style.whiteSpace = 'nowrap';
        announcer.style.border = '0';
        
        announcer.textContent = message;
        document.body.appendChild(announcer);
        
        setTimeout(() => {
            document.body.removeChild(announcer);
        }, 1000);
    }
    
    /**
     * Dodaje obserwatora zmian dostępności
     */
    observe(callback) {
        this.observers.add(callback);
        callback(this.state);
    }
    
    /**
     * Powiadamia obserwatorów o zmianach
     */
    notifyObservers() {
        this.observers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.warn('Error in accessibility observer:', error);
            }
        });
    }
}

// Export singleton instance
export const accessibilityService = new AccessibilityService(); 