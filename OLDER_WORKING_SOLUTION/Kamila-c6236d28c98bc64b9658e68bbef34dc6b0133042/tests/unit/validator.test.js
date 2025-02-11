import { DataValidator } from '@/services/validator';

describe('DataValidator', () => {
    describe('Order Validation', () => {
        test('should validate complete order data', () => {
            const validOrder = {
                id: 1,
                status: 'new',
                customer: { 
                    name: 'Test Customer',
                    email: 'test@example.com'
                },
                items: [{
                    name: 'Test Product',
                    quantity: 2,
                    price: 100
                }],
                total: 200
            };

            expect(() => DataValidator.validateOrder(validOrder)).not.toThrow();
        });

        test('should reject order without required fields', () => {
            const invalidOrder = {
                id: 1,
                status: 'new'
            };

            expect(() => DataValidator.validateOrder(invalidOrder))
                .toThrow('Brakujące pola');
        });

        test('should validate customer data', () => {
            const orderWithInvalidCustomer = {
                id: 1,
                status: 'new',
                customer: { name: 'Test' }, // brak email
                items: [],
                total: 0
            };

            expect(() => DataValidator.validateOrder(orderWithInvalidCustomer))
                .toThrow('Nieprawidłowe dane klienta');
        });

        test('should validate items array', () => {
            const orderWithInvalidItems = {
                id: 1,
                status: 'new',
                customer: { 
                    name: 'Test',
                    email: 'test@example.com'
                },
                items: [{ name: 'Test' }], // brak quantity i price
                total: 0
            };

            expect(() => DataValidator.validateOrder(orderWithInvalidItems))
                .toThrow('Nieprawidłowe dane produktu');
        });
    });

    describe('Response Validation', () => {
        test('should validate correct API response', () => {
            const validResponse = {
                total: 5,
                orders: []
            };

            expect(() => DataValidator.validateResponse(validResponse)).not.toThrow();
        });

        test('should reject invalid response format', () => {
            const invalidResponse = null;
            expect(() => DataValidator.validateResponse(invalidResponse))
                .toThrow('Nieprawidłowa odpowiedź API');
        });

        test('should validate orders array', () => {
            const responseWithInvalidOrders = {
                orders: 'not an array'
            };

            expect(() => DataValidator.validateResponse(responseWithInvalidOrders))
                .toThrow('Nieprawidłowy format listy zamówień');
        });
    });
}); 