async function loadTranslations() {
    const plTranslations = await fetch('./locales/polish.json').then(res => res.json());
    const enTranslations = await fetch('./locales/english.json').then(res => res.json());
    const uaTranslations = await fetch('./locales/ukrainian.json').then(res => res.json());

    // Initialize debug mode from localStorage
    const debugEnabled = localStorage.getItem('debugMode') === 'true';
    document.body.classList.toggle('debug-enabled', debugEnabled);
    
    // Show/hide debug panel based on stored preference
    const debugPanel = document.querySelector('.debug-panel');
    if (debugPanel) {
        debugPanel.style.display = debugEnabled ? 'flex' : 'none';
    }

    return {
        pl: plTranslations,
        en: enTranslations,
        ua: uaTranslations
    };
}

export default loadTranslations;
