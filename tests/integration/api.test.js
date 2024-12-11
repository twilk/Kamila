import { darwinApi } from '../../src/services/darwinApi';

describe('DARWINA.PL API Integration', () => {
    beforeAll(async () => {
        await darwinApi.initialize();
    });

    test('should fetch lead counts', async () => {
        const counts = await darwinApi.fetchLeadCounts();
        
        expect(counts).toHaveProperty('submitted');
        expect(counts).toHaveProperty('confirmed');
        expect(counts).toHaveProperty('accepted');
        expect(counts).toHaveProperty('ready');
        
        // Sprawdź czy liczby są nieujemne
        Object.values(counts).forEach(count => {
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    test('should fetch lead details', async () => {
        const statusId = API_CONFIG.DARWIN.STATUS_CODES.SUBMITTED.id;
        const details = await darwinApi.getLeadDetails(statusId);
        
        expect(Array.isArray(details)).toBe(true);
        
        if (details.length > 0) {
            const order = details[0];
            expect(order).toHaveProperty('id');
            expect(order).toHaveProperty('status');
            expect(order).toHaveProperty('customer');
        }
    });
}); 