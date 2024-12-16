const fs = require('fs');
const path = require('path');

describe('Employee List', () => {
    const sourceFile = path.join(__dirname, '../../c:/Users/Wilk/Downloads/zadanie.txt');
    const usersDir = path.join(__dirname, '../../users');
    
    test('should have JSON files for all active employees', () => {
        // Wczytaj oryginalną listę pracowników
        const data = fs.readFileSync(sourceFile, 'utf8');
        const originalEmployees = data
            .split('\n')
            .filter(line => line.includes('\t') && /\d+$/.test(line.trim()))
            .map(line => {
                const [name, id] = line.split('\t').map(col => col.trim());
                return { name, id };
            });

        // Wczytaj wygenerowane pliki JSON
        const files = fs.readdirSync(usersDir).filter(file => file.endsWith('.json'));
        const generatedEmployees = files.map(file => {
            const data = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
            return {
                name: data.fullName,
                id: data.memberId
            };
        });

        // Sprawdź czy wszyscy pracownicy zostali uwzględnieni
        originalEmployees.forEach(emp => {
            const found = generatedEmployees.find(gen => gen.id === emp.id);
            expect(found).toBeTruthy();
            expect(found.name).toBe(emp.name);
        });
    });
}); 