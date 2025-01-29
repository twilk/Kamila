import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

/**
 * @extends {BaseManager}
 * Manages sound volume and mute state
 */
export class VolumeManager extends BaseManager {
    /** @private */
    static #instance = null;

    /** @private */
    #volume = 100;

    /** @private */
    #isMuted = false;

    /**
     * Get singleton instance
     * @returns {VolumeManager}
     */
    static getInstance() {
        if (!VolumeManager.#instance) {
            VolumeManager.#instance = new VolumeManager();
        }
        return VolumeManager.#instance;
    }

    constructor() {
        super('VolumeManager');
        if (VolumeManager.#instance) {
            throw new Error('Use VolumeManager.getInstance()');
        }
        VolumeManager.#instance = this;
    }

    /**
     * Initialize volume manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            // Load volume settings
            await this.#loadSettings();

            // Set up event listeners
            this.#setupEventListeners();

            this.log(LogLevel.SUCCESS, '🔊 Volume manager initialized');
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
    #setupEventListeners() {
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
    async #loadSettings() {
        try {
            const settings = await chrome.storage.local.get(['volume', 'muted']);
            this.#volume = settings.volume ?? 100;
            this.#isMuted = settings.muted ?? false;
            this.#updateUI();
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '#loadSettings'
            });
        }
    }

    /**
     * Update UI elements with current volume state
     * @private
     */
    #updateUI() {
        try {
            const volumeButton = document.getElementById('volume-button');
            const volumeSlider = document.getElementById('volume-slider');

            if (volumeButton) {
                volumeButton.classList.toggle('muted', this.#isMuted);
            }

            if (volumeSlider) {
                volumeSlider.value = this.#volume;
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '#updateUI'
            });
        }
    }

    /**
     * Set volume level
     * @param {number} value - Volume level (0-100)
     */
    setVolume(value) {
        try {
            this.#volume = Math.max(0, Math.min(100, value));
            this.#isMuted = this.#volume === 0;
            this.#updateUI();
            chrome.storage.local.set({ volume: this.#volume, muted: this.#isMuted });
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
            this.#isMuted = !this.#isMuted;
            this.#updateUI();
            chrome.storage.local.set({ muted: this.#isMuted });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'toggleMute'
            });
        }
    }

    /**
     * Get current effective volume (0 if muted)
     * @returns {number} Current volume level
     */
    getVolume() {
        return this.#isMuted ? 0 : this.#volume;
    }

    /**
     * Clean up resources
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            // Clean up event listeners if needed
            const volumeButton = document.getElementById('volume-button');
            const volumeSlider = document.getElementById('volume-slider');

            if (volumeButton) {
                volumeButton.removeEventListener('click', this.toggleMute);
            }

            if (volumeSlider) {
                volumeSlider.removeEventListener('input', this.setVolume);
            }

            // Reset instance
            VolumeManager.#instance = null;

            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.MEDIUM, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const volumeManager = VolumeManager.getInstance(); 