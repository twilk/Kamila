export const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.applyTheme(savedTheme);
        
        // Nasłuchuj zmian
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.applyTheme(e.target.value));
        });
    },

    applyTheme(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
        localStorage.setItem('theme', theme);
        document.querySelector(`input[value="${theme}"]`).checked = true;
    }
}; 