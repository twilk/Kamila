import { i18n } from './i18n.js';

export class UIManager {
    constructor() {
        this.tooltipList = [];
    }

    initializeTooltips() {
        try {
            if (typeof bootstrap === 'undefined') {
                throw new Error('Bootstrap nie jest załadowany');
            }

            // Usuń stare tooltips
            if (this.tooltipList?.length) {
                this.tooltipList.forEach(tooltip => {
                    try {
                        tooltip?.dispose();
                    } catch (e) {
                        // Ignoruj błędy przy usuwaniu tooltipów
                    }
                });
            }
            
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            this.tooltipList = [...tooltipTriggerList].map(el => {
                try {
                    return new bootstrap.Tooltip(el, {
                        animation: true,
                        delay: { show: 100, hide: 100 },
                        placement: 'auto',
                        trigger: 'hover focus'
                    });
                } catch (e) {
                    logToPanel('❌ Błąd inicjalizacji tooltipa', 'error', e);
                    return null;
                }
            }).filter(Boolean);
        } catch (error) {
            logToPanel('❌ Błąd inicjalizacji tooltipów', 'error', error);
        }
    }

    showMessage(type, key) {
        const message = document.querySelector(`.${type}-message`);
        if (message) {
            message.textContent = i18n.translate(key);
            message.classList.remove('d-none');
        }
    }

    hideMessage(type) {
        const message = document.querySelector(`.${type}-message`);
        if (message) {
            message.classList.add('d-none');
        }
    }

    hideAllMessages() {
        document.querySelectorAll('.error-message, .loading-message').forEach(el => {
            el.classList.add('d-none');
        });
    }

    adjustWindowHeight() {
        const debugPanel = document.querySelector('.debug-panel');
        if (debugPanel && document.body.classList.contains('debug-enabled')) {
            const debugPanelHeight = debugPanel.offsetHeight;
            document.body.style.height = `calc(var(--window-height) + ${debugPanelHeight/2}px)`;
        } else {
            document.body.style.height = 'var(--window-height)';
        }
    }

    async resizeWindow(height) {
        try {
            if (chrome?.windows?.getCurrent) {
                const window = await chrome.windows.getCurrent();
                await chrome.windows.update(window.id, { height });
            } else {
                document.body.style.height = `${height}px`;
            }
        } catch (error) {
            logToPanel('❌ Błąd zmiany rozmiaru okna', 'error', error);
            document.body.style.height = `${height}px`;
        }
    }

    showLoader(counter) {
        counter.innerHTML = `
            <div class="loader-wrapper">
                <div class="loader-circle"></div>
                <div class="loader-circle"></div>
                <div class="loader-circle"></div>
                <div class="loader-shadow"></div>
                <div class="loader-shadow"></div>
                <div class="loader-shadow"></div>
            </div>
        `;
    }

    handleError(error) {
        console.error('Error:', error);
        logToPanel('❌ Wystąpił błąd podczas pobierania danych', 'error');
        
        document.querySelectorAll('.lead-count').forEach(counter => {
            counter.textContent = '-';
            counter.classList.add('count-error');
        });
    }
} 