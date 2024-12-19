/**
 * Konfiguracja domyślnych kolorów i motywów
 */
export const DEFAULT_COLORS = {
    primary: '#495057',
    secondary: '#6c757d'
};

export const THEME_CONFIG = {
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
            bg: '#495057',
            text: '#f8f9fa',
            border: '#6c757d',
            hover: '#5a6268',
            active: '#6c757d'
        }
    },
    states: {
        hover: 'rgba(0, 0, 0, 0.05)',
        active: 'rgba(0, 0, 0, 0.1)',
        focus: 'rgba(0, 123, 255, 0.25)'
    }
}; 