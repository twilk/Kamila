export class DataValidator {
    static validateOrder(order) {
        const required = ['id', 'status', 'customer', 'items', 'total'];
        const missing = required.filter(field => !order[field]);
        
        if (missing.length > 0) {
            throw new Error(`Brakujące pola w zamówieniu: ${missing.join(', ')}`);
        }

        // Walidacja customer
        if (!order.customer.name || !order.customer.email) {
            throw new Error('Nieprawidłowe dane klienta');
        }

        // Walidacja items
        if (!Array.isArray(order.items) || order.items.length === 0) {
            throw new Error('Brak produktów w zamówieniu');
        }

        order.items.forEach(item => {
            if (!item.name || !item.quantity || !item.price) {
                throw new Error('Nieprawidłowe dane produktu');
            }
        });

        return true;
    }

    static validateResponse(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Nieprawidłowa odpowiedź API');
        }

        if (data.orders && !Array.isArray(data.orders)) {
            throw new Error('Nieprawidłowy format listy zamówień');
        }

        return true;
    }
} 