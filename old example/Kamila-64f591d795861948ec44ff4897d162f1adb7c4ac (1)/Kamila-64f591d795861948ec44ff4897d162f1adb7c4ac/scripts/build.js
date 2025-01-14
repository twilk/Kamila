const fs = require('fs-extra');
const path = require('path');

async function build() {
    try {
        // Wyczyść katalog dist
        await fs.remove('dist');
        await fs.ensureDir('dist');

        // Kopiuj pliki
        const filesToCopy = [
            'manifest.json',
            'credentials.json',
            'background.js',
            'version.json',
            'icon16.png',
            'icon48.png',
            'icon128.png',
            'popup.html',
            'popup.js',
            'style.css'
        ];

        for (const file of filesToCopy) {
            await fs.copy(file, path.join('dist', file));
        }

        // Kopiuj katalogi
        const directoriesToCopy = [
            'src',
            'locales',
            'wallpapers'
        ];

        for (const dir of directoriesToCopy) {
            await fs.copy(dir, path.join('dist', dir));
        }

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 