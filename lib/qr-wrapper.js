import qrcode from 'qrcode-generator';

export class QRWrapper {
    static generate(data, options = {}) {
        const {
            errorCorrectionLevel = 'L',
            cellSize = 4,
            margin = 4
        } = options;

        const qr = qrcode(0, errorCorrectionLevel);
        qr.addData(data);
        qr.make();

        return qr.createDataURL(cellSize, margin);
    }

    static async generateAsync(data, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const qrDataUrl = this.generate(data, options);
                resolve(qrDataUrl);
            } catch (error) {
                reject(error);
            }
        });
    }
} 