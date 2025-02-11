const fs = require('fs');
const path = require('path');

describe('User JSON Files', () => {
    const usersDir = path.join(__dirname, '../../users');
    const files = fs.readdirSync(usersDir).filter(file => file.endsWith('.json'));
    
    test('should have user files in users directory', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    test.each(files)('file %s should have valid JSON structure', (filename) => {
        const filePath = path.join(usersDir, filename);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const userData = JSON.parse(fileContent);

        // Sprawdź strukturę każdego pliku
        expect(userData).toEqual(
            expect.objectContaining({
                status: expect.stringMatching(/^Aktywny$/),
                fullName: expect.any(String),
                isManager: expect.any(Boolean),
                email: expect.any(String),
                sellyId: expect.any(String),
                memberId: expect.any(String),
                qrCodeUrl: expect.any(String)
            })
        );

        // Sprawdź czy memberId w nazwie pliku zgadza się z zawartością
        const fileId = filename.replace('.json', '');
        expect(userData.memberId).toBe(fileId);
    });

    test('should have unique memberIds', () => {
        const memberIds = files.map(f => f.replace('.json', ''));
        const uniqueIds = new Set(memberIds);
        expect(memberIds.length).toBe(uniqueIds.size);
    });

    test('should have valid email format', () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        files.forEach(filename => {
            const filePath = path.join(usersDir, filename);
            const userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            expect(userData.email).toMatch(emailRegex);
        });
    });

    test('should have valid Google Drive image IDs', () => {
        const files = fs.readdirSync(usersDir).filter(file => file.endsWith('.json'));
        const driveIdRegex = /^[a-zA-Z0-9_-]+$/;
        
        files.forEach(filename => {
            const filePath = path.join(usersDir, filename);
            const userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (userData.qrCodeUrl) {
                expect(userData.qrCodeUrl).toMatch(driveIdRegex);
            }
        });
    });
}); 