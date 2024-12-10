import { darwinApi } from '@/services/darwinApi';
import { API_CONFIG } from '@/config/api';

describe('Darwin API Extended Integration', () => {
    beforeAll(async () => {
        await darwinApi.initialize();
    });

    test('should handle complete order flow', async () => {
        // Pobierz zamówienia w statusie "złożone"
        const submittedOrders = await darwinApi.getLeadDetails(
            API_CONFIG.DARWIN.STATUS_CODES.SUBMITTED.id
        );
        expect(Array.isArray(submittedOrders)).toBe(true);

        // Sprawdź szczegóły pierwszego zamówienia
        if (submittedOrders.length > 0) {
            const order = submittedOrders[0];
            expect(order.customer).toBeDefined();
            expect(order.items).toBeDefined();
            expect(Array.isArray(order.items)).toBe(true);
        }
    });

    test('should fetch and validate products', async () => {
        const products = await darwinApi.getProducts();
        expect(Array.isArray(products)).toBe(true);

        if (products.length > 0) {
            const product = products[0];
            expect(product).toHaveProperty('id');
            expect(product).toHaveProperty('name');
            expect(product).toHaveProperty('price');
        }
    });

    test('should fetch and validate customers', async () => {
        const customers = await darwinApi.getCustomers();
        expect(Array.isArray(customers)).toBe(true);

        if (customers.length > 0) {
            const customer = customers[0];
            expect(customer).toHaveProperty('id');
            expect(customer).toHaveProperty('name');
            expect(customer).toHaveProperty('email');
        }
    });

    test('should handle concurrent requests', async () => {
        const promises = [
            darwinApi.fetchLeadCounts(),
            darwinApi.getProducts(),
            darwinApi.getCustomers()
        ];

        const results = await Promise.all(promises);
        results.forEach(result => {
            expect(result).toBeDefined();
        });
    });
}); 