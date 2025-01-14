import { i18n } from '../../services/i18n.js';

export class UpdateManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    async downloadUpdate() {
        try {
            const response = await fetch('https://api.darwina.pl/updates/latest');
            if (!response.ok) {
                throw new Error('Nie udało się pobrać aktualizacji');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'kamila-update.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Error downloading update:', error);
            throw new Error('Błąd podczas pobierania aktualizacji: ' + error.message);
        }
    }

    initializeUpdateButton() {
        const updateButton = document.getElementById('update-button');
        if (!updateButton) return;

        updateButton.addEventListener('click', async () => {
            try {
                const updateModal = document.getElementById('updateModal');
                const modalBody = updateModal.querySelector('.modal-body');
                const modalTitle = updateModal.querySelector('.modal-title');
                const confirmBtn = document.getElementById('confirmUpdate');
                const cancelBtn = document.getElementById('cancelUpdate');
                
                modalTitle.textContent = 'Dostępna aktualizacja';
                modalBody.innerHTML = `
                    <div class="update-status">
                        <p>Czy chcesz zaktualizować rozszerzenie do najnowszej wersji?</p>
                        <div class="progress d-none">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                 role="progressbar" style="width: 0%"></div>
                        </div>
                        <div class="update-message mt-2"></div>
                    </div>
                `;

                const modal = new bootstrap.Modal(updateModal);
                modal.show();

                confirmBtn.addEventListener('click', async () => {
                    try {
                        updateButton.disabled = true;
                        confirmBtn.disabled = true;
                        cancelBtn.disabled = true;
                        modalTitle.textContent = 'Aktualizacja w toku';
                        
                        const progressBar = modalBody.querySelector('.progress');
                        const progressBarInner = progressBar.querySelector('.progress-bar');
                        const messageDiv = modalBody.querySelector('.update-message');
                        
                        progressBar.classList.remove('d-none');
                        progressBarInner.style.width = '25%';
                        messageDiv.innerHTML = '<span class="text-primary">⬇️ Pobieranie aktualizacji...</span>';
                        logToPanel('🔄 Rozpoczynam aktualizację...', 'info');

                        await this.downloadUpdate();
                        progressBarInner.style.width = '50%';
                        messageDiv.innerHTML += '<br><span class="text-success">✅ Aktualizacja pobrana</span>';
                        logToPanel('✅ Aktualizacja pobrana', 'success');

                        progressBarInner.style.width = '75%';
                        messageDiv.innerHTML += '<br>📦 Rozpakuj pobrany plik <strong>kamila-update.zip</strong>';
                        messageDiv.innerHTML += '<br>📂 Skopiuj zawartość folderu do lokalizacji rozszerzenia';
                        messageDiv.innerHTML += '<br>🔄 Odśwież rozszerzenie w <strong>chrome://extensions</strong>';

                        progressBarInner.style.width = '100%';
                        messageDiv.innerHTML += '<br><span class="text-success">✅ Gotowe! Odśwież rozszerzenie aby zastosować zmiany.</span>';
                        
                        confirmBtn.textContent = 'Zamknij';
                        confirmBtn.disabled = false;
                        cancelBtn.classList.add('d-none');
                        
                        confirmBtn.addEventListener('click', () => {
                            modal.hide();
                            updateButton.disabled = false;
                            updateButton.innerHTML = 'Sprawdź aktualizacje';
                        }, { once: true });

                    } catch (error) {
                        modalBody.querySelector('.progress').classList.add('d-none');
                        modalBody.querySelector('.update-message').innerHTML = 
                            `<div class="alert alert-danger">❌ Błąd aktualizacji: ${error.message}</div>`;
                        logToPanel('❌ Błąd podczas aktualizacji', 'error', error);
                        
                        confirmBtn.disabled = false;
                        cancelBtn.disabled = false;
                        updateButton.disabled = false;
                        updateButton.innerHTML = 'Sprawdź aktualizacje';
                    }
                });

                cancelBtn.addEventListener('click', () => {
                    modal.hide();
                    updateButton.disabled = false;
                    updateButton.innerHTML = 'Sprawdź aktualizacje';
                });

            } catch (error) {
                logToPanel('❌ Błąd aktualizacji', 'error', error);
                updateButton.disabled = false;
                updateButton.innerHTML = 'Sprawdź aktualizacje';
            }
        });
    }
} 