import { logService } from './LogService.js';
import { CacheService } from './CacheService.js';

export class WallpaperService {
    constructor() {
        this.wallpapers = new Map();
        this.currentWallpaper = null;
        this.listeners = new Set();
        logService.info('🎨 Wallpaper service initialized');
    }

    async initialize() {
        try {
            await this.loadWallpapers();
        } catch (error) {
            logService.error('Failed to initialize wallpaper service:', error);
            throw error;
        }
    }

    async loadWallpaper(wallpaper) {
        try {
            const response = await fetch(wallpaper.url);
            const blob = await response.blob();
            wallpaper.dataUrl = URL.createObjectURL(blob);
            this.wallpapers.set(wallpaper.id, wallpaper);
            logService.debug(`Loaded wallpaper: ${wallpaper.id}`);
        } catch (error) {
            logService.error(`Failed to load wallpaper ${wallpaper.id}:`, error);
            throw error;
        }
    }

    async addCustomWallpaper(file) {
        try {
            // Validate file
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('Invalid file type');
            }

            // Create wallpaper object
            const wallpaper = {
                id: `custom-${Date.now()}`,
                name: file.name,
                type: 'custom',
                url: URL.createObjectURL(file)
            };

            // Load and store wallpaper
            await this.loadWallpaper(wallpaper);
            this.notifyListeners();

            logService.info('✨ Custom wallpaper added');
            return wallpaper.id;
        } catch (error) {
            logService.error('Failed to add custom wallpaper:', error);
            throw error;
        }
    }

    async setWallpaper(id) {
        try {
            const wallpaper = this.wallpapers.get(id);
            if (!wallpaper) {
                throw new Error('Invalid wallpaper ID');
            }

            this.currentWallpaper = wallpaper;
            this.notifyListeners();
            logService.info('🎨 Wallpaper updated');
        } catch (error) {
            logService.error('Failed to set wallpaper:', error);
            throw error;
        }
    }

    applyWallpaper(element) {
        if (this.currentWallpaper) {
            element.style.backgroundImage = `url(${this.currentWallpaper.dataUrl})`;
            logService.debug(`Applied wallpaper: ${this.currentWallpaper.id}`);
        } else {
            element.style.backgroundImage = '';
            logService.debug('Removed wallpaper');
        }
    }

    async removeWallpaper(id) {
        try {
            const wallpaper = this.wallpapers.get(id);
            if (!wallpaper || wallpaper.type !== 'custom') {
                throw new Error('Cannot remove non-custom wallpaper');
            }

            // Cleanup
            URL.revokeObjectURL(wallpaper.dataUrl);
            this.wallpapers.delete(id);

            // Reset current if needed
            if (this.currentWallpaper?.id === id) {
                this.currentWallpaper = null;
            }

            this.notifyListeners();
            logService.info('🗑️ Wallpaper removed');
        } catch (error) {
            logService.error('Failed to remove wallpaper:', error);
            throw error;
        }
    }

    notifyListeners() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    getCurrentWallpaper() {
        return this.wallpapers.get(this.currentWallpaper) || null;
    }

    cleanup() {
        for (const wallpaper of this.wallpapers.values()) {
            if (wallpaper.url) {
                URL.revokeObjectURL(wallpaper.url);
            }
        }
        this.wallpapers.clear();
        logService.debug('Cleaned up wallpaper service');
    }
}

export const wallpaperService = new WallpaperService(); 