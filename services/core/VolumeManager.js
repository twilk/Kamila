import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { VOLUME_CONFIG } from '../../config/volume.js';

/**
 * @extends {BaseManager}
 * Manages sound volume and mute state
 */
class VolumeManager extends BaseManager {
    /** @private */
    static #instance = null;

    /** @private */
    #volume = 100;

    /** @private */
    #isMuted = false;

    /** @private */
    static _registry = null;

    /** @private */
    #settings;

    /**
     * Get singleton instance
     * @returns {VolumeManager}
     */
    static getInstance() {
        if (!VolumeManager.#instance && VolumeManager._registry) {
            VolumeManager.#instance = new VolumeManager(VolumeManager._registry);
        }
        return VolumeManager.#instance;
    }

    constructor(registry) {
        if (VolumeManager.#instance) {
            return VolumeManager.#instance;
        }
        super(registry, 'VolumeManager');
        VolumeManager.#instance = this;
        VolumeManager._registry = registry;
    }

    /**
     * Initialize volume manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing volume manager...');
            
            // Load volume settings
            const storage = await this.getDependency('storage');
            const settings = await storage.get(VOLUME_CONFIG.STORAGE_KEY) || {};
            this.#settings = { ...VOLUME_CONFIG.DEFAULT_SETTINGS, ...settings };
            
            // Set up event listeners
            this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ Volume manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
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

    static setRegistry(registry) {
        VolumeManager._registry = registry;
    }
}

// Export both class and instance
export { VolumeManager };
export const volumeManager = VolumeManager.getInstance(); 