import { API_CONFIG } from '@/config/api';

describe('API Configuration', () => {
    test('should have all required properties', () => {
        expect(API_CONFIG.SELLY).toBeDefined();
        expect(API_CONFIG.SELLY.BASE_URL).toBe('https://api.selly.pl');
        expect(API_CONFIG.SELLY.VERSION).toBe('v2');
    });

    test('should have correct status codes', () => {
        const { STATUS_CODES } = API_CONFIG.SELLY;
        expect(STATUS_CODES.SUBMITTED).toBe(1);
        expect(STATUS_CODES.CONFIRMED).toBe(2);
        expect(STATUS_CODES.ACCEPTED).toBe(3);
        expect(STATUS_CODES.READY).toBe(5);
        expect(STATUS_CODES.OVERDUE).toBe('overdue');
    });

    test('should have all required endpoints', () => {
        const { ENDPOINTS } = API_CONFIG.SELLY;
        expect(ENDPOINTS.ORDERS).toBe('/orders');
        expect(ENDPOINTS.ORDER_STATUS).toBe('/orders/status');
        expect(ENDPOINTS.ORDER_DETAILS).toBe('/orders/{id}');
    });
}); 