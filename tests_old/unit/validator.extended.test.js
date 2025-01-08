import { DataValidator } from '@/services/validator';

describe('Extended Validator Tests', () => {
    describe('Order Validation', () => {
        test('should validate order with all optional fields', () => {
            const order = {
                id: 1,
                status: 'new',
                customer: {
                    name: 'Test',
                    email: 'test@example.com',
                    phone: '123456789',
                    address: 'Test St. 1'
                },
                items: [
                    {
                        name: 'Product',
                        quantity: 1,
                        price: 100,
                        options: { color: 'red' }
                    }
                ],
                total: 100,
                notes: 'Test note',
                shipping: { method: 'express' }
            };

            expect(() => DataValidator.validateOrder(order)).not.toThrow();
        });

        test('should validate order items thoroughly', () => {
            const orderWithInvalidItems = {
                id: 1,
                status: 'new',
                customer: { name: 'Test', email: 'test@example.com' },
                items: [
                    { name: 'Product', quantity: -1, price: 100 }
                ],
                total: 100
            };

            expect(() => DataValidator.validateOrder(orderWithInvalidItems))
                .toThrow('Nieprawidłowa ilość produktu');
        });

        test('should validate order with missing optional fields', () => {
            const minimalOrder = {
                id: 1,
                status: 'new',
                customer: { name: 'Test', email: 'test@example.com' },
                items: [{ name: 'Product', quantity: 1, price: 100 }],
                total: 100
            };

            expect(() => DataValidator.validateOrder(minimalOrder)).not.toThrow();
        });

        test('should validate response with minimal data', () => {
            const minimalResponse = {
                orders: []
            };

            expect(() => DataValidator.validateResponse(minimalResponse)).not.toThrow();
        });

        test('should handle null values in order items', () => {
            const orderWithNullItems = {
                id: 1,
                status: 'new',
                customer: { name: 'Test', email: 'test@example.com' },
                items: null,
                total: 100
            };

            expect(() => DataValidator.validateOrder(orderWithNullItems))
                .toThrow('Brak produktów w zamówieniu');
        });

        test('should handle deeply nested validation errors', () => {
            const complexOrder = {
                id: 1,
                status: 'new',
                customer: { 
                    name: 'Test',
                    email: 'test@example.com',
                    address: {
                        invalid: true
                    }
                },
                items: [{ name: 'Product', quantity: 1, price: -100 }],
                total: 100
            };

            expect(() => DataValidator.validateOrder(complexOrder))
                .toThrow('Nieprawidłowa cena produktu');
        });

        test('should handle deeply corrupted order data', () => {
            const corruptedOrder = {
                id: 1,
                status: 'new',
                customer: Object.create(null),
                items: Array(1000).fill(null),
                total: NaN
            };

            expect(() => DataValidator.validateOrder(corruptedOrder))
                .toThrow('Nieprawidłowe dane klienta');
        });

        test('should validate order with edge case values', () => {
            const edgeCaseOrder = {
                id: Number.MAX_SAFE_INTEGER,
                status: 'new',
                customer: {
                    name: 'a'.repeat(256),
                    email: 'test@' + 'a'.repeat(253)
                },
                items: [
                    {
                        name: String.fromCharCode(0),
                        quantity: Number.MIN_VALUE,
                        price: 0.0000001
                    }
                ],
                total: 0
            };

            expect(() => DataValidator.validateOrder(edgeCaseOrder))
                .toThrow('Nieprawidłowe dane zamówienia');
        });
    });

    describe('Response Validation', () => {
        test('should validate pagination data', () => {
            const response = {
                orders: [],
                total: 0,
                page: 1,
                per_page: 20,
                total_pages: 1
            };

            expect(() => DataValidator.validateResponse(response)).not.toThrow();
        });

        test('should validate error responses', () => {
            const errorResponse = {
                error: {
                    code: 400,
                    message: 'Bad Request'
                }
            };

            expect(() => DataValidator.validateResponse(errorResponse))
                .toThrow('Nieprawidłowa odpowiedź API');
        });
    });
}); 