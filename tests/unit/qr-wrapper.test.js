import { QRWrapper } from '../../lib/qr-wrapper';

describe('QRWrapper', () => {
    test('should generate QR code synchronously', () => {
        const data = 'test data';
        const qrCode = QRWrapper.generate(data);
        
        expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });

    test('should generate QR code asynchronously', async () => {
        const data = 'test data';
        const qrCode = await QRWrapper.generateAsync(data);
        
        expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });

    test('should handle custom options', () => {
        const data = 'test data';
        const options = {
            errorCorrectionLevel: 'H',
            cellSize: 8,
            margin: 2
        };
        
        const qrCode = QRWrapper.generate(data, options);
        expect(qrCode).toMatch(/^data:image\/png;base64,/);
        // QR code with higher error correction should be larger
        expect(qrCode.length).toBeGreaterThan(
            QRWrapper.generate(data).length
        );
    });

    test('should handle errors gracefully', async () => {
        // Mock qrcode-generator to throw an error
        jest.spyOn(QRWrapper, 'generate').mockImplementationOnce(() => {
            throw new Error('QR generation failed');
        });

        await expect(QRWrapper.generateAsync('test'))
            .rejects
            .toThrow('QR generation failed');
    });
}); 