import { version } from '../manifest.json';

export class UpdateManager {
    constructor() {
        this.currentVersion = version;
        this.repoUrl = 'https://api.github.com/repos/twilk/Kamila';
        this.updateInProgress = false;
    }

    async checkForUpdates() {
        try {
            const latestRelease = await this.getLatestRelease();
            const hasUpdate = this.compareVersions(latestRelease.tag_name, this.currentVersion);
            
            return {
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion: latestRelease.tag_name,
                releaseNotes: latestRelease.body,
                downloadUrl: latestRelease.zipball_url
            };
        } catch (error) {
            console.error('Błąd sprawdzania aktualizacji:', error);
            throw new Error('Nie udało się sprawdzić aktualizacji');
        }
    }

    async getLatestRelease() {
        const response = await fetch(`${this.repoUrl}/releases/latest`);
        if (!response.ok) {
            throw new Error('Nie udało się pobrać informacji o najnowszej wersji');
        }
        return await response.json();
    }

    compareVersions(latest, current) {
        const latestParts = latest.replace('v', '').split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (latestParts[i] > currentParts[i]) return true;
            if (latestParts[i] < currentParts[i]) return false;
        }
        return false;
    }

    async downloadUpdate(downloadUrl) {
        if (this.updateInProgress) return;
        this.updateInProgress = true;

        try {
            // Pobierz archiwum
            const response = await fetch(downloadUrl);
            const blob = await response.blob();

            // Zapisz do pliku tymczasowego
            const tempUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = tempUrl;
            a.download = `kamila-update-${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(tempUrl);

            return true;
        } catch (error) {
            console.error('Błąd pobierania aktualizacji:', error);
            throw new Error('Nie udało się pobrać aktualizacji');
        } finally {
            this.updateInProgress = false;
        }
    }
} 