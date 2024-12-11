export const WallpaperManager = {
    async init() {
        try {
            // Załaduj manifest tapet
            const response = await fetch('wallpapers/manifest.json');
            if (!response.ok) throw new Error('Błąd ładowania manifestu tapet');
            const manifest = await response.json();
            
            // Wczytaj zapisaną tapetę lub użyj domyślnej
            const savedWallpaper = localStorage.getItem('wallpaper') || manifest.defaultWallpaper;
            await this.applyWallpaper(savedWallpaper);
            
            // Załaduj podglądy tapet
            this.loadPreviews(manifest.wallpapers);
            
            return true;
        } catch (error) {
            console.error('Wallpaper initialization error:', error);
            return false;
        }
    },

    loadPreviews(wallpapers) {
        const grid = document.getElementById('wallpapers-grid');
        if (!grid) return;

        wallpapers.forEach(wallpaper => {
            const preview = document.createElement('div');
            preview.className = 'wallpaper-item';
            preview.innerHTML = `
                <div class="wallpaper-preview" 
                     data-wallpaper="${wallpaper.id}"
                     style="background-image: url(wallpapers/${wallpaper.thumbnail})">
                </div>
            `;
            grid.appendChild(preview);
        });
    },

    async applyWallpaper(wallpaper) {
        try {
            if (wallpaper === 'default') {
                document.body.style.backgroundImage = '';
            } else {
                document.body.style.backgroundImage = `url(wallpapers/${wallpaper}.jpg)`;
            }
            localStorage.setItem('wallpaper', wallpaper);
            
            // Aktualizuj aktywną tapetę w UI
            document.querySelectorAll('.wallpaper-preview').forEach(preview => {
                preview.classList.toggle('active', preview.dataset.wallpaper === wallpaper);
            });
            
            return true;
        } catch (error) {
            console.error('Failed to apply wallpaper:', error);
            return false;
        }
    }
}; 