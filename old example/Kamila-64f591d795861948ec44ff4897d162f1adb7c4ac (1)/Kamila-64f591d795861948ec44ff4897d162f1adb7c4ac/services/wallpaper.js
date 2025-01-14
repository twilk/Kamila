import { sendLogToPopup } from '../config/api.js';

export class WallpaperService {
    constructor() {
        this.currentWallpaper = localStorage.getItem('wallpaper');
        this.maxSize = 2 * 1024 * 1024; // 2MB
        this.validTypes = [
            'image/jpeg', 'image/jpg', 'image/pjpeg',
            'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/tiff'
        ];
    }

    async setWallpaper(file) {
        try {
            if (!file) throw new Error('No file provided');
            
            // Validate file
            if (file.size > this.maxSize) {
                throw new Error('File too large (max 2MB)');
            }
            
            if (!this.validTypes.includes(file.type)) {
                throw new Error('Invalid file type');
            }

            // Create URL and save
            const url = URL.createObjectURL(file);
            localStorage.setItem('wallpaper', url);
            this.currentWallpaper = url;
            
            sendLogToPopup('✨ Wallpaper updated', 'success');
            return { success: true, url };
        } catch (error) {
            sendLogToPopup('❌ Wallpaper error', 'error', error.message);
            return { success: false, error: error.message };
        }
    }

    removeWallpaper() {
        try {
            if (this.currentWallpaper) {
                URL.revokeObjectURL(this.currentWallpaper);
            }
            localStorage.removeItem('wallpaper');
            this.currentWallpaper = null;
            sendLogToPopup('🗑️ Wallpaper removed', 'success');
            return true;
        } catch (error) {
            sendLogToPopup('❌ Error removing wallpaper', 'error', error.message);
            return false;
        }
    }

    getCurrentWallpaper() {
        return this.currentWallpaper;
    }
}

export const wallpaperService = new WallpaperService(); 