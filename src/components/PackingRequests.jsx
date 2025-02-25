import React, { useState, useEffect } from 'react';
import { OrderService } from '../services/api/OrderService';
import { EventManager } from '../services/core/EventManager';
import ProgressBar from './ProgressBar';
import ErrorBoundary from './ErrorBoundary';

const PackingRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadPackingRequests();
    }, []);

    const loadPackingRequests = async () => {
        try {
            setLoading(true);
            const orderService = OrderService.getInstance();
            const result = await orderService.getPackingRequests();
            
            if (result.success) {
                setRequests(result.data);
            } else {
                throw new Error(result.error || 'Failed to load packing requests');
            }
        } catch (error) {
            setError(error.message);
            EventManager.getInstance().emit('error:occurred', { 
                error, 
                context: 'PackingRequests' 
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePackingConfirmed = async (request) => {
        try {
            const orderService = OrderService.getInstance();
            const result = await orderService.confirmPacking(request);
            
            if (result.success) {
                // Refresh the list
                loadPackingRequests();
                // Show success notification
                EventManager.getInstance().emit('notification:show', {
                    type: 'success',
                    message: `Packing confirmed for order ${request.id}`
                });
            } else {
                throw new Error(result.error || 'Failed to confirm packing');
            }
        } catch (error) {
            EventManager.getInstance().emit('error:occurred', {
                error,
                context: 'PackingConfirmation'
            });
        }
    };

    if (loading) {
        return (
            <div className="loading-state p-4">
                <ProgressBar />
                <p className="text-sm text-gray-600 mt-2">Loading packing requests...</p>
            </div>
        );
    }

    if (error) {
        return (
            <ErrorBoundary>
                <div className="error-state p-4">
                    <h3 className="text-red-600">Error loading packing requests</h3>
                    <p className="text-sm text-gray-600">{error}</p>
                    <button 
                        onClick={loadPackingRequests}
                        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </ErrorBoundary>
        );
    }

    return (
        <div className="packing-requests">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 text-left border-b">Order ID</th>
                        <th className="p-2 text-left border-b">Store</th>
                        <th className="p-2 text-left border-b">Products</th>
                        <th className="p-2 text-left border-b">Shipping</th>
                        <th className="p-2 text-left border-b">Status</th>
                        <th className="p-2 text-left border-b">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map(request => (
                        <tr key={request.id} className="hover:bg-gray-50">
                            <td className="p-2 border-b">{request.id}</td>
                            <td className="p-2 border-b">{request.store.name}</td>
                            <td className="p-2 border-b">
                                <ul className="list-disc list-inside">
                                    {request.products.map(product => (
                                        <li key={product.id}>
                                            {product.name} (x{product.quantity})
                                        </li>
                                    ))}
                                </ul>
                            </td>
                            <td className="p-2 border-b">
                                {request.isShipping ? 'Yes' : 'No'}
                            </td>
                            <td className="p-2 border-b">
                                <span className={`px-2 py-1 rounded text-sm ${
                                    request.packed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {request.packed ? 'Packed' : 'Pending'}
                                </span>
                            </td>
                            <td className="p-2 border-b">
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={request.packed}
                                        onChange={() => handlePackingConfirmed(request)}
                                        className="form-checkbox h-4 w-4 text-blue-600"
                                    />
                                    <span className="text-sm text-gray-600">
                                        Confirm Packing
                                    </span>
                                </label>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PackingRequests; 