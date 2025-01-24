import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * @extends {BaseManager}
 * Manages sound volume and mute state
 */
export class VolumeManager extends BaseManager {
    static _instance = null;

    static getInstance() {
        if (!VolumeManager._instance) {
            VolumeManager._instance = new VolumeManager();
        }
        return VolumeManager._instance;
    }

    constructor() {
        super('VolumeManager');
        if (VolumeManager._instance) {
            throw new Error('Use VolumeManager.getInstance()');
        }
        VolumeManager._instance = this;
        this._volume = 100;
        this._isMuted = false;
    }

    /**
     * Initialize volume manager
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            await super.initialize();
            this._setupEventListeners();
            await this._loadSettings();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Set up volume control event listeners
     * @private
     */
    _setupEventListeners() {
        const volumeButton = document.getElementById('volume-button');
        const volumeSlider = document.getElementById('volume-slider');

        if (volumeButton) {
            volumeButton.addEventListener('click', () => this.toggleMute());
        }

        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        }
    }

    /**
     * Load volume settings from storage
     * @private
     */
    async _loadSettings() {
        try {
            const settings = await chrome.storage.local.get(['volume', 'muted']);
            this._volume = settings.volume ?? 100;
            this._isMuted = settings.muted ?? false;
            this._updateUI();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '_loadSettings'
            });
        }
    }

    /**
     * Update volume UI elements
     * @private
     */
    _updateUI() {
        const volumeButton = document.getElementById('volume-button');
        const volumeSlider = document.getElementById('volume-slider');

        if (volumeButton) {
            volumeButton.classList.toggle('muted', this._isMuted);
        }

        if (volumeSlider) {
            volumeSlider.value = this._volume;
        }
    }

    /**
     * Set volume level
     * @param {number} value Volume level (0-100)
     */
    setVolume(value) {
        try {
            this._volume = Math.max(0, Math.min(100, value));
            this._isMuted = this._volume === 0;
            this._updateUI();
            chrome.storage.local.set({ volume: this._volume, muted: this._isMuted });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'setVolume',
                value
            });
        }
    }

    /**
     * Toggle mute state
     */
    toggleMute() {
        try {
            this._isMuted = !this._isMuted;
            this._updateUI();
            chrome.storage.local.set({ muted: this._isMuted });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'toggleMute'
            });
        }
    }

    /**
     * Get current volume level
     * @returns {number} Volume level (0-100)
     */
    getVolume() {
        return this._isMuted ? 0 : this._volume;
    }

    /**
     * Cleanup and dispose
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            const volumeButton = document.getElementById('volume-button');
            const volumeSlider = document.getElementById('volume-slider');

            if (volumeButton) {
                volumeButton.removeEventListener('click', this.toggleMute);
            }

            if (volumeSlider) {
                volumeSlider.removeEventListener('input', this.setVolume);
            }

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const volumeManager = VolumeManager.getInstance(); 