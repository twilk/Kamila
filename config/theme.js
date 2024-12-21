/**
 * Konfiguracja animacji motywów
 */
export const THEME_ANIMATION_CONFIG = {
    duration: 300,
    timing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    properties: [
        'background-color',
        'color',
        'border-color',
        'box-shadow'
    ]
};

/**
 * Konfiguracja dostępności
 */
export const ACCESSIBILITY_CONFIG = {
    minContrast: 4.5, // WCAG AA
    focusRingWidth: '2px',
    focusRingColor: 'var(--primary)',
    reducedMotion: {
        duration: '0.01ms',
        properties: [
            'transition',
            'animation'
        ]
    }
};

/**
 * Konfiguracja wydajności
 */
export const PERFORMANCE_CONFIG = {
    targetFps: 60,
    maxJank: 2,
    thresholds: {
        themeSwitch: 50, // ms
        panelAnimation: 16.67 // ms (1 frame @ 60fps)
    }
};

/**
 * Domyślne kolory dla motywu niestandardowego
 */
export const DEFAULT_COLORS = {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    light: '#f8f9fa',
    dark: '#343a40'
};

/**
 * Oblicza kontrast między kolorami
 * @param {string} color1 - Pierwszy kolor w formacie hex
 * @param {string} color2 - Drugi kolor w formacie hex
 * @returns {number} - Współczynnik kontrastu (WCAG)
 */
export function calculateContrastRatio(color1, color2) {
    const getLuminance = (hex) => {
        const rgb = parseInt(hex.slice(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = rgb & 0xff;
        
        const [rs, gs, bs] = [r/255, g/255, b/255].map(val => 
            val <= 0.03928 ? val/12.92 : Math.pow((val + 0.055)/1.055, 2.4)
        );
        
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Sprawdza czy kolory spełniają wymogi WCAG dla kontrastu
 */
export function validateThemeColors(colors) {
    const minContrast = 4.5; // WCAG AA standard
    
    return {
        isValid: calculateContrastRatio(colors.primary, colors.secondary) >= minContrast,
        contrast: calculateContrastRatio(colors.primary, colors.secondary)
    };
}

/**
 * Podstawowa konfiguracja motywów
 */
const BASE_THEME_CONFIG = {
    transition: {
        speed: '0.3s',
        timing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    },
    light: {
        background: '#ffffff',
        text: '#212529',
        border: '#dee2e6',
        shadow: 'rgba(0, 0, 0, 0.15)',
        panel: {
            bg: '#ffffff',
            text: '#212529',
            border: '#dee2e6',
            shadow: 'rgba(0, 0, 0, 0.15)'
        },
        button: {
            bg: '#f8f9fa',
            text: '#212529',
            border: '#dee2e6',
            hover: '#e9ecef',
            active: '#dde0e3'
        }
    },
    dark: {
        background: '#212529',
        text: '#f8f9fa',
        border: '#495057',
        shadow: 'rgba(0, 0, 0, 0.25)',
        panel: {
            bg: '#343a40',
            text: '#f8f9fa',
            border: '#495057',
            shadow: 'rgba(0, 0, 0, 0.25)'
        },
        button: {
            bg: '#343a40',
            text: '#f8f9fa',
            border: '#495057',
            hover: '#3d4246',
            active: '#343a40'
        }
    },
    states: {
        hover: 'rgba(0, 0, 0, 0.05)',
        active: 'rgba(0, 0, 0, 0.1)',
        focus: 'rgba(0, 123, 255, 0.25)'
    }
};

/**
 * Główna konfiguracja motywów
 */
export const THEME_CONFIG = {
    lightTheme: {
        name: 'light',
        colors: {
            ...DEFAULT_COLORS,
            background: '#ffffff',
            text: '#212529',
            border: '#dee2e6'
        }
    },
    darkTheme: {
        name: 'dark',
        colors: {
            ...DEFAULT_COLORS,
            background: '#212529',
            text: '#ffffff',
            border: '#495057'
        }
    },
    transition: BASE_THEME_CONFIG.transition,
    states: BASE_THEME_CONFIG.states,
    animation: THEME_ANIMATION_CONFIG,
    accessibility: ACCESSIBILITY_CONFIG,
    performance: PERFORMANCE_CONFIG
};

export const THEME_STORAGE_KEY = 'kamila_theme_settings';