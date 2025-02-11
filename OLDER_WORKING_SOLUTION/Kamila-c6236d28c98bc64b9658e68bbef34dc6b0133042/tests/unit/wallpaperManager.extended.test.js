import { WallpaperManager } from '@/services/wallpaperManager';

describe('Extended Wallpaper Manager Tests', () => {
    let wallpaperManager;

    beforeEach(() => {
        wallpaperManager = new WallpaperManager();
        localStorage.clear();
        URL.createObjectURL = jest.fn(blob => 'blob:test');
        URL.revokeObjectURL = jest.fn();
    });

    test('should load default wallpapers', async () => {
        const mockManifest = [
            { id: 'default', file: 'default.jpg' },
            { id: 'dark', file: 'dark.jpg' }
        ];

        fetch
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve(mockManifest)
            }))
            .mockImplementation(() => Promise.resolve({
                blob: () => Promise.resolve(new Blob())
            }));

        await wallpaperManager.initialize();
        expect(wallpaperManager.wallpapers.size).toBe(2);
    });

    test('should validate image dimensions', async () => {
        const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
        const mockImage = {
            width: 2000,
            height: 1500
        };

        global.Image = class {
            constructor() {
                setTimeout(() => {
                    this.onload();
                }, 100);
                return mockImage;
            }
        };

        await expect(wallpaperManager.addCustomWallpaper(mockFile))
            .rejects
            .toThrow('Obraz jest zbyt duży');
    });

    test('should handle wallpaper removal', async () => {
        const mockWallpaper = {
            id: 'custom-1',
            url: 'blob:test',
            custom: true
        };

        wallpaperManager.wallpapers.set(mockWallpaper.id, mockWallpaper);
        wallpaperManager.currentWallpaper = mockWallpaper.id;

        wallpaperManager.removeCustomWallpaper(mockWallpaper.id);

        expect(wallpaperManager.wallpapers.has(mockWallpaper.id)).toBe(false);
        expect(wallpaperManager.currentWallpaper).toBe('default');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockWallpaper.url);
    });

    test('should persist custom wallpapers', async () => {
        const mockWallpaper = {
            id: 'custom-1',
            name: 'Test',
            url: 'blob:test',
            custom: true
        };

        wallpaperManager.wallpapers.set(mockWallpaper.id, mockWallpaper);
        wallpaperManager.saveCustomWallpapers();

        const saved = JSON.parse(localStorage.getItem('customWallpapers'));
        expect(saved).toHaveLength(1);
        expect(saved[0].id).toBe(mockWallpaper.id);
    });

    test('should apply wallpaper to body', () => {
        const mockWallpaper = {
            id: 'test',
            url: 'test.jpg'
        };

        wallpaperManager.wallpapers.set(mockWallpaper.id, mockWallpaper);
        wallpaperManager.setWallpaper(mockWallpaper.id);

        expect(document.body.style.backgroundImage).toBe(`url(${mockWallpaper.url})`);
    });

    test('should handle failed wallpaper loading', async () => {
        fetch.mockRejectedValueOnce(new Error('Failed to load'));
        await wallpaperManager.loadWallpaper({ id: 'test', file: 'test.jpg' });
        expect(wallpaperManager.wallpapers.has('test')).toBe(false);
    });

    test('should handle invalid wallpaper ID', () => {
        expect(() => wallpaperManager.setWallpaper('non-existent'))
            .toThrow('Tapeta nie istnieje');
    });

    test('should handle removal of non-custom wallpaper', () => {
        wallpaperManager.wallpapers.set('default', { id: 'default', custom: false });
        wallpaperManager.removeCustomWallpaper('default');
        expect(wallpaperManager.wallpapers.has('default')).toBe(true);
    });

    test('should handle wallpaper removal errors', () => {
        const mockWallpaper = {
            id: 'test',
            url: 'invalid-url',
            custom: true
        };

        wallpaperManager.wallpapers.set(mockWallpaper.id, mockWallpaper);
        URL.revokeObjectURL.mockImplementationOnce(() => { throw new Error(); });
        
        wallpaperManager.removeCustomWallpaper(mockWallpaper.id);
        expect(wallpaperManager.wallpapers.has(mockWallpaper.id)).toBe(false);
    });

    test('should handle wallpaper removal with corrupted state', async () => {
        const mockWallpaper = {
            id: 'test',
            url: new Proxy({}, {
                get: () => { throw new Error('Proxy error'); }
            }),
            custom: true
        };

        wallpaperManager.wallpapers.set(mockWallpaper.id, mockWallpaper);
        wallpaperManager.currentWallpaper = mockWallpaper.id;

        // Symuluj błąd localStorage
        localStorage.setItem = jest.fn(() => { throw new Error('Storage error'); });

        wallpaperManager.removeCustomWallpaper(mockWallpaper.id);
        expect(wallpaperManager.wallpapers.has(mockWallpaper.id)).toBe(false);
        expect(wallpaperManager.currentWallpaper).toBe('default');
    });

    test('should handle concurrent wallpaper operations', async () => {
        const operations = [];
        
        // Symuluj wiele równoczesnych operacji
        for (let i = 0; i < 10; i++) {
            const mockFile = new File([''], `test${i}.jpg`, { type: 'image/jpeg' });
            operations.push(wallpaperManager.addCustomWallpaper(mockFile));
        }

        await Promise.all(operations);
        expect(wallpaperManager.wallpapers.size).toBeGreaterThan(0);
    });
}); 