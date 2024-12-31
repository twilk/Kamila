import { logService } from './LogService.js';
import { WallpaperService } from './WallpaperService.js';

export class WallpaperManager {
    constructor() {
        this.wallpapers = new Map();
        this.customWallpapers = new Map();
        this.listeners = new Set();
        logService.info('WallpaperManager constructed');
    }

    async initialize() {
        try {
            logService.info('Initializing WallpaperManager...');
            await this.loadDefaultWallpapers();
            await this.loadCustomWallpapers();
            logService.info('WallpaperManager initialized successfully');
        } catch (error) {
            logService.error('Failed to initialize WallpaperManager', error);
            throw error;
        }
    }

    async loadDefaultWallpapers() {
        try {
            logService.debug('Loading default wallpapers...');
            const defaultWallpapers = await this.fetchDefaultWallpapers();
            defaultWallpapers.forEach(wallpaper => {
                this.wallpapers.set(wallpaper.id, wallpaper);
            });
            logService.debug(`Loaded ${defaultWallpapers.length} default wallpapers`);
        } catch (error) {
            logService.error('Failed to load default wallpapers', error);
            throw error;
        }
    }

    async loadCustomWallpapers() {
        try {
            logService.debug('Loading custom wallpapers...');
            const customWallpapers = await this.fetchCustomWallpapers();
            customWallpapers.forEach(wallpaper => {
                this.customWallpapers.set(wallpaper.id, wallpaper);
            });
            logService.debug(`Loaded ${customWallpapers.length} custom wallpapers`);
        } catch (error) {
            logService.error('Failed to load custom wallpapers', error);
            throw error;
        }
    }

    async addCustomWallpaper(wallpaper) {
        try {
            logService.debug('Adding custom wallpaper...');
            const id = await this.saveCustomWallpaper(wallpaper);
            this.customWallpapers.set(id, { ...wallpaper, id });
            this.notifyListeners();
            logService.info('Custom wallpaper added successfully', { id });
            return id;
        } catch (error) {
            logService.error('Failed to add custom wallpaper', error);
            throw error;
        }
    }

    async removeCustomWallpaper(id) {
        try {
            logService.debug(`Removing custom wallpaper: ${id}`);
            await this.deleteCustomWallpaper(id);
            this.customWallpapers.delete(id);
            this.notifyListeners();
            logService.info('Custom wallpaper removed successfully', { id });
        } catch (error) {
            logService.error('Failed to remove custom wallpaper', error);
            throw error;
        }
    }

    getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const dimensions = { width: img.width, height: img.height };
                logService.debug('Image dimensions obtained', dimensions);
                resolve(dimensions);
            };
            img.onerror = () => {
                const error = new Error('Failed to load image');
                logService.error('Failed to get image dimensions', error);
                reject(error);
            };
            img.src = URL.createObjectURL(file);
        });
    }
}

export const wallpaperManagerService = new WallpaperManager(); 