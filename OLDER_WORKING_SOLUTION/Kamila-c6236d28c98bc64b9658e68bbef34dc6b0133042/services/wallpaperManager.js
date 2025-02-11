export class WallpaperManager {
    constructor() {
        this.wallpapers = new Map();
        this.currentWallpaper = localStorage.getItem('currentWallpaper') || 'default';
    }

    async initialize() {
        // Załaduj domyślne tapety z katalogu wallpapers
        try {
            const response = await fetch('wallpapers/manifest.json');
            const wallpapers = await response.json();
            
            for (const wallpaper of wallpapers) {
                await this.loadWallpaper(wallpaper);
            }
        } catch (error) {
            console.error('Błąd ładowania tapet:', error);
        }

        // Załaduj zapisane własne tapety
        const customWallpapers = JSON.parse(localStorage.getItem('customWallpapers') || '[]');
        for (const wallpaper of customWallpapers) {
            this.wallpapers.set(wallpaper.id, wallpaper);
        }

        this.applyCurrentWallpaper();
    }

    async loadWallpaper(wallpaper) {
        try {
            const response = await fetch(`wallpapers/${wallpaper.file}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            this.wallpapers.set(wallpaper.id, {
                ...wallpaper,
                url
            });
        } catch (error) {
            console.error(`Błąd ładowania tapety ${wallpaper.id}:`, error);
        }
    }

    async addCustomWallpaper(file) {
        try {
            // Walidacja
            if (!file.type.startsWith('image/')) {
                throw new Error('Wybrany plik nie jest obrazem');
            }

            if (file.size > 2 * 1024 * 1024) { // 2MB
                throw new Error('Plik jest zbyt duży (max 2MB)');
            }

            // Sprawdź wymiary
            const dimensions = await this.getImageDimensions(file);
            if (dimensions.width > 1600 || dimensions.height > 1200) {
                throw new Error('Obraz jest zbyt duży (max 1600x1200px)');
            }

            const id = 'custom-' + Date.now();
            const url = URL.createObjectURL(file);
            
            const wallpaper = {
                id,
                name: file.name,
                url,
                custom: true
            };

            this.wallpapers.set(id, wallpaper);
            this.saveCustomWallpapers();
            
            return wallpaper;
        } catch (error) {
            console.error('Błąd dodawania tapety:', error);
            throw error;
        }
    }

    getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    setWallpaper(id) {
        if (!this.wallpapers.has(id) && id !== 'default') {
            throw new Error('Tapeta nie istnieje');
        }

        this.currentWallpaper = id;
        localStorage.setItem('currentWallpaper', id);
        this.applyCurrentWallpaper();
    }

    applyCurrentWallpaper() {
        const wallpaper = this.wallpapers.get(this.currentWallpaper);
        if (wallpaper) {
            document.body.style.backgroundImage = `url(${wallpaper.url})`;
        } else {
            document.body.style.backgroundImage = 'none';
        }
    }

    removeCustomWallpaper(id) {
        if (!this.wallpapers.has(id)) return;
        
        const wallpaper = this.wallpapers.get(id);
        if (!wallpaper.custom) return;

        URL.revokeObjectURL(wallpaper.url);
        this.wallpapers.delete(id);
        
        if (this.currentWallpaper === id) {
            this.setWallpaper('default');
        }

        this.saveCustomWallpapers();
    }

    saveCustomWallpapers() {
        const customWallpapers = Array.from(this.wallpapers.values())
            .filter(w => w.custom);
        localStorage.setItem('customWallpapers', JSON.stringify(customWallpapers));
    }

    getAllWallpapers() {
        return Array.from(this.wallpapers.values());
    }
} 