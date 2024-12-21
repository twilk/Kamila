import { i18n } from '../services/i18n.js';

export class CustomThemeModal {
    constructor(themeManager) {
        this.themeManager = themeManager;
        this.modal = null;
        this.initialize();
    }

    initialize() {
        // Tworzenie modalu
        const modalHtml = `
            <div class="modal fade" id="customThemeModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" data-i18n="customTheme.title">Własny motyw</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Podgląd -->
                            <div class="custom-theme-preview mb-4 p-3 border rounded">
                                <h6 data-i18n="customTheme.preview">Podgląd</h6>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-primary btn-sm">Przycisk</button>
                                    <span class="badge bg-primary">Badge</span>
                                </div>
                            </div>
                            
                            <!-- Kolory -->
                            <div class="mb-3">
                                <label class="form-label" data-i18n="customTheme.background">Tło</label>
                                <input type="color" class="form-control" id="customTheme-bg">
                            </div>
                            <div class="mb-3">
                                <label class="form-label" data-i18n="customTheme.text">Tekst</label>
                                <input type="color" class="form-control" id="customTheme-text">
                            </div>
                            <div class="mb-3">
                                <label class="form-label" data-i18n="customTheme.primary">Kolor główny</label>
                                <input type="color" class="form-control" id="customTheme-primary">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" data-i18n="close">Zamknij</button>
                            <button type="button" class="btn btn-primary" id="saveCustomTheme" data-i18n="save">Zapisz</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Dodaj modal do DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Inicjalizuj modal Bootstrap
        this.modal = new bootstrap.Modal(document.getElementById('customThemeModal'));

        // Podgląd na żywo
        const preview = document.querySelector('.custom-theme-preview');
        const inputs = document.querySelectorAll('input[type="color"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updatePreview(preview));
        });

        // Obsługa zapisywania
        document.getElementById('saveCustomTheme').addEventListener('click', () => {
            const customTheme = {
                background: document.getElementById('customTheme-bg').value,
                text: document.getElementById('customTheme-text').value,
                primary: document.getElementById('customTheme-primary').value
            };
            
            try {
                this.themeManager.setCustomTheme(customTheme);
                this.modal.hide();
            } catch (error) {
                console.error('Failed to save custom theme:', error);
                // TODO: Pokaż błąd w UI
            }
        });
    }

    updatePreview(preview) {
        const bg = document.getElementById('customTheme-bg').value;
        const text = document.getElementById('customTheme-text').value;
        const primary = document.getElementById('customTheme-primary').value;

        preview.style.backgroundColor = bg;
        preview.style.color = text;
        preview.querySelector('.btn-primary').style.backgroundColor = primary;
        preview.querySelector('.badge').style.backgroundColor = primary;
    }

    show() {
        // Załaduj aktualne wartości
        const currentTheme = this.themeManager.getCustomTheme() || {
            background: '#ffffff',
            text: '#000000',
            primary: '#0d6efd'
        };

        document.getElementById('customTheme-bg').value = currentTheme.background;
        document.getElementById('customTheme-text').value = currentTheme.text;
        document.getElementById('customTheme-primary').value = currentTheme.primary;

        // Aktualizuj podgląd
        this.updatePreview(document.querySelector('.custom-theme-preview'));

        this.modal.show();
    }
} 