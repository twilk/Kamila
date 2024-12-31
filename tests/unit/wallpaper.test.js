import { wallpaperService } from '../../services/WallpaperService.js';
import { logService } from '../../services/LogService.js';

describe('Wallpaper Service', () => {
    let wallpaperService;
    
    beforeEach(() => {
        localStorage.clear();
        URL.createObjectURL = jest.fn(() => 'blob:test-url');
        URL.revokeObjectURL = jest.fn();
        wallpaperService = new WallpaperService();
    });

    test('should validate file size', async () => {
        const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'test.jpg', {
            type: 'image/jpeg'
        });
        
        const result = await wallpaperService.setWallpaper(largeFile);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File too large');
    });

    test('should validate file type', async () => {
        const invalidFile = new File(['test'], 'test.txt', {
            type: 'text/plain'
        });
        
        const result = await wallpaperService.setWallpaper(invalidFile);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid file type');
    });

    test('should set valid wallpaper', async () => {
        const validFile = new File(['test'], 'test.jpg', {
            type: 'image/jpeg'
        });
        
        const result = await wallpaperService.setWallpaper(validFile);
        expect(result.success).toBe(true);
        expect(result.url).toBe('blob:test-url');
        expect(localStorage.getItem('wallpaper')).toBe('blob:test-url');
    });

    test('should remove wallpaper', () => {
        localStorage.setItem('wallpaper', 'test-url');
        
        const result = wallpaperService.removeWallpaper();
        expect(result).toBe(true);
        expect(localStorage.getItem('wallpaper')).toBeNull();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
}); 