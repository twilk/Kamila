import { sendLogToPopup } from '../config/api.js';

export const ThemeManager = {
    setTheme(theme) {
        try {
            document.body.classList.remove('light-theme', 'dark-theme');
            document.body.classList.add(`${theme}-theme`);
            localStorage.setItem('theme', theme);
            sendLogToPopup('🎨 Theme changed', 'success', theme);
        } catch (error) {
            sendLogToPopup('❌ Theme change failed', 'error', error.message);
        }
    }
}; 