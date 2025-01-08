import { sendLogToPopup } from '../config/api.js';

export class UpdateManager {
    constructor() {
        // Using GitHub's archive download URL
        this.updateUrl = 'https://github.com/twilk/Kamila/archive/refs/heads/main.zip';
        this.updateInProgress = false;
    }

    async downloadUpdate() {
        if (this.updateInProgress) {
            throw new Error('Update already in progress');
        }

        this.updateInProgress = true;
        try {
            // Use chrome.downloads API for better handling
            const downloadId = await chrome.downloads.download({
                url: this.updateUrl,
                filename: 'kamila-update.zip',
                conflictAction: 'overwrite'
            });

            return new Promise((resolve, reject) => {
                chrome.downloads.onChanged.addListener(function onChanged(delta) {
                    if (delta.id === downloadId) {
                        if (delta.state?.current === 'complete') {
                            chrome.downloads.onChanged.removeListener(onChanged);
                            resolve(true);
                        } else if (delta.error) {
                            chrome.downloads.onChanged.removeListener(onChanged);
                            reject(new Error(`Download failed: ${delta.error.current}`));
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Download error:', error);
            throw new Error(error.message || 'Failed to download update');
        } finally {
            this.updateInProgress = false;
        }
    }

    async applyUpdate() {
        // Reload the extension
        await chrome.runtime.reload();
    }
}
