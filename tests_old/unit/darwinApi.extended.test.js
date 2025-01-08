test('should handle empty response data', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
    }));

    const result = await darwinApi.getLeadDetails(1);
    expect(result).toEqual([]);
});

test('should handle missing customer data', async () => {
    const mockOrder = {
        id: 1,
        status_id: 1,
        items: []
    };

    const result = darwinApi.transformOrdersData([mockOrder]);
    expect(result[0].customer).toEqual({ name: undefined, email: undefined });
});

test('should handle missing items data', async () => {
    const mockOrder = {
        id: 1,
        status_id: 1,
        customer: { name: 'Test' }
    };

    const result = darwinApi.transformOrdersData([mockOrder]);
    expect(result[0].items).toEqual([]);
});

test('should handle transformation errors', async () => {
    const malformedOrder = {
        id: 1,
        status_id: 'invalid',
        items: [{ invalid: true }]
    };

    const result = darwinApi.transformOrdersData([malformedOrder]);
    expect(result[0].items[0]).toEqual({
        name: undefined,
        quantity: undefined,
        price: undefined
    });
});

test('should handle severe transformation errors', async () => {
    const corruptedOrder = {
        id: Symbol('invalid'), // Niemożliwy do serializacji typ
        status_id: null,
        items: new Proxy({}, {
            get: () => { throw new Error('Proxy error'); }
        })
    };

    const result = darwinApi.transformOrdersData([corruptedOrder]);
    expect(result).toEqual([{
        id: undefined,
        status: 'Nieznany',
        customer: { name: undefined, email: undefined },
        items: [],
        total: undefined,
        created_at: undefined,
        modified_at: undefined
    }]);
});

test('should handle circular references', async () => {
    const circularOrder = {
        id: 1,
        status_id: 1
    };
    circularOrder.self = circularOrder; // Referencja cykliczna

    const result = darwinApi.transformOrdersData([circularOrder]);
    expect(result[0].id).toBe(1);
    expect(result[0].status).toBeDefined();
}); 