import { sendLogToPopup } from '../config/api.js';

export class ThemeService {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.applyTheme(this.currentTheme);
    }

    applyTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(`${theme}-theme`);
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;
        sendLogToPopup(`🎨 Theme changed to ${theme}`, 'info');
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        return newTheme;
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

export const themeService = new ThemeService(); 