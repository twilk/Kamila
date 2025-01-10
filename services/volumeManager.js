import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class VolumeManager extends BaseManager {
    constructor() {
        super();
        this.volume = 100;
        this.isMuted = false;
        this.volumeListeners = new Set();
    }

    async initialize() {
        try {
            await super.initialize();
            await this.loadVolumeSettings();
            await this.initializeVolumeControls();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    async loadVolumeSettings() {
        try {
            const { volume, isMuted } = await chrome.storage.local.get(['volume', 'isMuted']);
            
            if (typeof volume === 'number') {
                this.volume = volume;
            }
            
            if (typeof isMuted === 'boolean') {
                this.isMuted = isMuted;
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.WARNING, {
                method: 'loadVolumeSettings'
            });
        }
    }

    async initializeVolumeControls() {
        try {
            const volumeButton = document.getElementById('volume-button');
            const volumeSlider = document.getElementById('volume-slider');

            if (!volumeButton || !volumeSlider) return;

            // Set initial states
            volumeSlider.value = this.volume;
            volumeButton.classList.toggle('muted', this.isMuted);

            // Handle mute button click
            volumeButton.addEventListener('click', () => {
                this.toggleMute();
            });

            // Handle volume slider change
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(parseInt(e.target.value, 10));
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeVolumeControls'
            });
        }
    }

    async setVolume(volume) {
        try {
            // Validate volume
            if (typeof volume !== 'number' || volume < 0 || volume > 100) {
                throw new Error('Invalid volume value');
            }

            this.volume = volume;
            
            // Update UI
            const volumeButton = document.getElementById('volume-button');
            const volumeSlider = document.getElementById('volume-slider');

            if (volumeSlider) {
                volumeSlider.value = volume;
            }

            if (volumeButton) {
                volumeButton.classList.toggle('muted', volume === 0);
            }

            // Update muted state
            this.isMuted = volume === 0;

            // Save settings
            await chrome.storage.local.set({ 
                volume: this.volume,
                isMuted: this.isMuted
            });

            // Notify listeners
            this.notifyVolumeChange();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'setVolume',
                volume
            });
            return false;
        }
    }

    async toggleMute() {
        try {
            this.isMuted = !this.isMuted;

            const volumeButton = document.getElementById('volume-button');
            const volumeSlider = document.getElementById('volume-slider');

            if (volumeButton) {
                volumeButton.classList.toggle('muted', this.isMuted);
            }

            if (volumeSlider) {
                volumeSlider.value = this.isMuted ? 0 : this.volume;
            }

            // Save settings
            await chrome.storage.local.set({ isMuted: this.isMuted });

            // Notify listeners
            this.notifyVolumeChange();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'toggleMute'
            });
            return false;
        }
    }

    getVolume() {
        return this.isMuted ? 0 : this.volume;
    }

    isMuted() {
        return this.isMuted;
    }

    addVolumeListener(callback) {
        this.volumeListeners.add(callback);
        return () => this.volumeListeners.delete(callback);
    }

    notifyVolumeChange() {
        const volume = this.getVolume();
        this.volumeListeners.forEach(listener => {
            try {
                listener(volume);
            } catch (error) {
                this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.WARNING, {
                    method: 'notifyVolumeChange',
                    listener: 'volumeChange'
                });
            }
        });
    }

    dispose() {
        try {
            this.volumeListeners.clear();
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 