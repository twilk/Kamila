/**
 * Content script dla rozszerzenia KAMILA
 * Obsługuje integrację z DARWINA.PL
 */

// Inicjalizacja nasłuchiwania wiadomości od popup i background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'APPLY_THEME':
            applyTheme(message.theme);
            sendResponse({ success: true });
            break;
            
        case 'SYNC_THEME':
            syncThemeWithPage(message.theme);
            sendResponse({ success: true });
            break;
            
        case 'GET_PAGE_THEME':
            const currentTheme = getCurrentPageTheme();
            sendResponse({ theme: currentTheme });
            break;
    }
    return true; // Keep message channel open for async responses
});

/**
 * Aplikuje motyw do strony
 * @param {Object} theme - Konfiguracja motywu
 */
function applyTheme(theme) {
    const root = document.documentElement;
    
    // Usuń poprzednie klasy motywów
    root.classList.remove('light-theme', 'dark-theme', 'custom-theme');
    
    // Dodaj nową klasę motywu
    root.classList.add(`${theme.name}-theme`);
    
    // Zastosuj niestandardowe kolory jeśli to motyw custom
    if (theme.name === 'custom' && theme.colors) {
        root.style.setProperty('--primary', theme.colors.primary);
        root.style.setProperty('--secondary', theme.colors.secondary);
    }
    
    // Dodaj klasę dla animacji przejścia
    root.classList.add('theme-transition');
    
    // Usuń klasę animacji po zakończeniu
    setTimeout(() => {
        root.classList.remove('theme-transition');
    }, 300);
}

/**
 * Synchronizuje motyw ze stroną
 * @param {Object} theme - Konfiguracja motywu
 */
function syncThemeWithPage(theme) {
    // Znajdź elementy strony wymagające synchronizacji
    const elements = document.querySelectorAll('.theme-aware');
    
    elements.forEach(element => {
        element.classList.remove('light-theme', 'dark-theme', 'custom-theme');
        element.classList.add(`${theme.name}-theme`);
    });
}

/**
 * Pobiera aktualny motyw strony
 * @returns {string} Nazwa aktualnego motywu
 */
function getCurrentPageTheme() {
    const root = document.documentElement;
    if (root.classList.contains('dark-theme')) return 'dark';
    if (root.classList.contains('custom-theme')) return 'custom';
    return 'light'; // domyślny motyw
}

// Inicjalizacja przy załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    // Pobierz zapisany motyw z local storage
    chrome.storage.local.get(['theme'], (result) => {
        if (result.theme) {
            applyTheme(result.theme);
        }
    });
    
    // Obserwuj zmiany w DOM aby zachować spójność motywu
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes);
                addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        if (node.classList.contains('theme-aware')) {
                            chrome.storage.local.get(['theme'], (result) => {
                                if (result.theme) {
                                    syncThemeWithPage(result.theme);
                                }
                            });
                        }
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}); 