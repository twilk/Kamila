import { WallpaperManager } from '@/services/wallpaper';

describe('WallpaperManager', () => {
    beforeEach(() => {
        // Wyczyść localStorage
        localStorage.clear();
        
        // Przygotuj DOM
        document.body.innerHTML = `
            <div id="wallpapers-grid"></div>
        `;
        
        // Mock fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    wallpapers: [
                        {
                            id: 'OBR1',
                            name: 'Obraz 1',
                            file: 'OBR1.jpg',
                            thumbnail: 'OBR1_thumb.jpg'
                        }
                    ],
                    defaultWallpaper: 'default'
                })
            })
        );
    });

    test('should initialize with default wallpaper', async () => {
        await WallpaperManager.init();
        expect(document.body.style.backgroundImage).toBe('');
        expect(localStorage.getItem('wallpaper')).toBe('default');
    });

    test('should load wallpaper previews', async () => {
        await WallpaperManager.init();
        const grid = document.getElementById('wallpapers-grid');
        expect(grid.children.length).toBe(1);
        expect(grid.querySelector('[data-wallpaper="OBR1"]')).toBeTruthy();
    });

    test('should apply wallpaper', async () => {
        await WallpaperManager.applyWallpaper('OBR1');
        expect(document.body.style.backgroundImage).toBe('url(wallpapers/OBR1.jpg)');
        expect(localStorage.getItem('wallpaper')).toBe('OBR1');
    });

    test('should handle errors gracefully', async () => {
        // Symuluj błąd fetch
        global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
        
        const result = await WallpaperManager.init();
        expect(result).toBe(false);
    });
}); 