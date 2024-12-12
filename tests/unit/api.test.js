import { darwinApi } from '@/services/darwinApi';
import { API_CONFIG } from '@/config/api';
import { sendLogToPopup } from '../../config/api.js';

// Dodajmy mocki dla API
const mockApiResponses = {
    orders: {
        submitted: { total: 5 },
        confirmed: { total: 3 },
        accepted: { total: 2 },
        ready: { total: 1 }
    },
    credentials: {
        apiKey: 'test-key',
        apiSecret: 'test-secret'
    }
};

describe('DARWINA.PL API Service Tests', () => {
    beforeEach(() => {
        fetch.mockClear();
        localStorage.clear();
        sendLogToPopup('🧪 Starting API test', 'info');

        // Mockujemy fetch dla API
        global.fetch = jest.fn((url) => {
            if (url.includes('/orders')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockApiResponses.orders)
                });
            }
            if (url.includes('/credentials')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockApiResponses.credentials)
                });
            }
            return Promise.reject(new Error('Unknown endpoint'));
        });
    });

    afterEach(() => {
        sendLogToPopup('✅ API test completed', 'success');
    });

    describe('Initialization', () => {
        test('should initialize API with valid credentials', async () => {
            const mockCredentials = {
                apiKey: 'valid-key',
                apiSecret: 'valid-secret'
            };

            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockCredentials)
            }));

            await darwinApi.initialize();

            expect(darwinApi.credentials).toEqual(mockCredentials);
            expect(darwinApi.getHeaders()).toEqual({
                'Authorization': `Bearer ${mockCredentials.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            });
            sendLogToPopup('✅ API endpoints test passed', 'success');
        });

        test('should handle initialization failures', async () => {
            const errors = [
                { status: 401, message: 'Invalid credentials' },
                { status: 404, message: 'Credentials file not found' },
                { status: 500, message: 'Server error' }
            ];

            for (const error of errors) {
                fetch.mockImplementationOnce(() => Promise.resolve({
                    ok: false,
                    status: error.status,
                    statusText: error.message
                }));

                await expect(darwinApi.initialize())
                    .rejects
                    .toThrow(error.message);
                
                expect(darwinApi.credentials).toBeNull();
            }
            sendLogToPopup('✅ API endpoints test passed', 'success');
        });
    });

    describe('Order Operations', () => {
        beforeEach(async () => {
            // Setup valid credentials
            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ apiKey: 'test-key' })
            }));
            await darwinApi.initialize();
        });

        test('should fetch and transform orders correctly', async () => {
            const mockOrders = [
                {
                    id: 1,
                    status_id: API_CONFIG.DARWIN.STATUS_CODES.SUBMITTED.id,
                    customer_name: 'Test Customer',
                    customer_email: 'test@example.com',
                    items: [
                        { product_name: 'Test Product', quantity: 2, price: 100 }
                    ],
                    total_amount: 200,
                    created_at: '2024-01-01T12:00:00Z',
                    modified_at: '2024-01-01T12:30:00Z'
                }
            ];

            fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ orders: mockOrders })
            }));

            const result = await darwinApi.getLeadDetails(
                API_CONFIG.DARWIN.STATUS_CODES.SUBMITTED.id
            );

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 1,
                status: 'Złożone',
                customer: {
                    name: 'Test Customer',
                    email: 'test@example.com'
                },
                items: [
                    {
                        name: 'Test Product',
                        quantity: 2,
                        price: 100
                    }
                ],
                total: 200,
                created_at: '2024-01-01T12:00:00Z',
                modified_at: '2024-01-01T12:30:00Z'
            });
            sendLogToPopup('✅ API endpoints test passed', 'success');
        });

        test('should count orders by status correctly', async () => {
            const mockResponses = new Map([
                [API_CONFIG.DARWIN.STATUS_CODES.SUBMITTED.id, { total: 5 }],
                [API_CONFIG.DARWIN.STATUS_CODES.CONFIRMED.id, { total: 3 }],
                [API_CONFIG.DARWIN.STATUS_CODES.ACCEPTED.id, { total: 2 }],
                [API_CONFIG.DARWIN.STATUS_CODES.READY.id, { total: 1 }]
            ]);

            fetch.mockImplementation((url) => {
                const statusId = Number(new URL(url).searchParams.get('status_id'));
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockResponses.get(statusId))
                });
            });

            const counts = await darwinApi.fetchLeadCounts();

            expect(counts).toEqual({
                submitted: 5,
                confirmed: 3,
                accepted: 2,
                ready: 1
            });

            expect(fetch).toHaveBeenCalledTimes(mockResponses.size);
            sendLogToPopup('✅ API endpoints test passed', 'success');
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await darwinApi.initialize();
        });

        test('should handle network errors gracefully', async () => {
            const networkErrors = [
                new Error('Network timeout'),
                new Error('DNS resolution failed'),
                new TypeError('Failed to fetch')
            ];

            for (const error of networkErrors) {
                fetch.mockRejectedValueOnce(error);

                await expect(darwinApi.getLeadDetails(1))
                    .rejects
                    .toThrow();

                expect(console.error).toHaveBeenCalledWith(
                    'Błąd API:',
                    expect.any(Error)
                );
            }
            sendLogToPopup('✅ API endpoints test passed', 'success');
        });

        test('should handle rate limiting with exponential backoff', async () => {
            let attempts = 0;
            const maxAttempts = 3;

            fetch.mockImplementation(() => {
                attempts++;
                if (attempts < maxAttempts) {
                    return Promise.resolve({
                        ok: false,
                        status: 429,
                        statusText: 'Too Many Requests'
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ orders: [] })
                });
            });

            const startTime = Date.now();
            await darwinApi.getLeadDetails(1);
            const duration = Date.now() - startTime;

            expect(attempts).toBe(maxAttempts);
            expect(duration).toBeGreaterThan(
                (Math.pow(2, maxAttempts - 1) - 1) * 1000 // Minimalny czas dla backoff
            );
            sendLogToPopup('✅ API endpoints test passed', 'success');
        });
    });
}); 