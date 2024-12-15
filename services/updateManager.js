import { sendLogToPopup } from '../config/api.js';

export class UpdateManager {
    constructor() {
        this.repoUrl = 'https://api.github.com/repos/twilk/Kamila';
        this.updateInProgress = false;

        // Get the current version from the manifest
        const manifest = chrome.runtime.getManifest();
        this.currentVersion = manifest.version;
    }

    async checkForUpdates() {
        try {
            const release = await this.getLatestRelease();
            if (!release) {
                console.log('No release info available');
                return { hasUpdate: false };
            }
            const hasUpdate = this.compareVersions(release.tag_name, this.currentVersion);
            
            sendLogToPopup('🔄 Update check completed', 'info');

            return {
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion: release.tag_name,
                releaseNotes: release.body,
                downloadUrl: release.zipball_url
            };
        } catch (error) {
            console.log('Update check skipped:', error.message);
            return { hasUpdate: false };
        }
    }

    async getLatestRelease() {
        try {
            const response = await fetch(`${this.repoUrl}/releases/latest`);
            if (!response.ok) {
                return null;
            }
            return await response.json();
        } catch (error) {
            return null;
        }
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
            sendLogToPopup('❌ Update download failed', 'error', error.message);
            throw new Error('Nie udało się pobrać aktualizacji');
        } finally {
            this.updateInProgress = false;
        }
    }
}
