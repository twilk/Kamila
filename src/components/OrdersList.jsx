import React, { memo, useCallback, useEffect } from 'react';
import { AutoSizer, List as VirtualList } from 'react-virtualized';
import ErrorBoundary from './ErrorBoundary';
import ProgressBar from './ProgressBar';
import useOrders from '../hooks/useOrders';
import { EventManager } from '../services/core/EventManager';

// Stałe ze statusami zamówień
const ORDER_STATUSES = {
  NEW: '1',
  CONFIRMED: '2',
  ACCEPTED: '3',
  READY_FOR_PICKUP: '5'
};

const MemoizedOrderCard = memo(function OrderCard({ order, style }) {
  return (
    <div 
      className="order-card p-4 border-b hover:bg-gray-50 transition-colors"
      style={style}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">Order #{order.id}</h3>
          <p className="text-sm text-gray-600">
            Status: {order.status_name}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium">${order.totalValue}</p>
          {order.isOverdue && (
            <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
              Overdue
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-700">
        {order.items?.length} items
      </div>
    </div>
  );
}, (prev, next) => prev.order.id === next.order.id);

function OrdersList({ statusId, dateRange }) {
  const { orders, loading, error, progress, counts } = useOrders(statusId, dateRange);
  
  // Emit counters:updated event when counts change
  useEffect(() => {
    console.log('💩 [UI] Checking if counts changed:', counts);
    
    if (counts) {
      console.log('💩 [UI] Mapping counts to HTML format:', counts);
      
      // Map to match data-status attributes in HTML
      const mappedCounts = {
        '1': counts[ORDER_STATUSES.NEW] || 0,
        '2': counts[ORDER_STATUSES.CONFIRMED] || 0,
        '3': counts[ORDER_STATUSES.ACCEPTED] || 0,
        'ready': counts['ready'] || 0,
        'overdue': counts['overdue'] || 0
      };

      console.log('💩 [UI] Mapped counts:', mappedCounts);

      // Emit event with correctly mapped counters
      const eventManager = EventManager.getInstance();
      console.log('💩 [UI] Emitting counters:updated event');
      eventManager.emit('counters:updated', mappedCounts);
    }
  }, [counts]);
  
  const rowRenderer = useCallback(({ index, style }) => {
    console.log('💩 [UI] Rendering order row:', index);
    return (
      <MemoizedOrderCard
        order={orders[index]}
        style={style}
      />
    );
  }, [orders]);
  
  if (error) {
    console.log('💩 [UI] Rendering error state:', error);
    return (
      <ErrorBoundary>
        <div className="error-state">
          <h3>Failed to load orders</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </ErrorBoundary>
    );
  }
  
  if (loading) {
    console.log('💩 [UI] Rendering loading state:', progress);
    return (
      <div className="loading-state p-4">
        <ProgressBar 
          value={progress.loaded} 
          max={progress.totalPages * 100} 
        />
        <p className="text-sm text-gray-600 mt-2">
          Loading orders... {progress.page}/{progress.totalPages}
        </p>
      </div>
    );
  }
  
  console.log('💩 [UI] Rendering orders list:', orders.length);
  return (
    <div className="orders-list h-full">
      <AutoSizer>
        {({ height, width }) => (
          <VirtualList
            width={width}
            height={height}
            rowCount={orders.length}
            rowHeight={100}
            rowRenderer={rowRenderer}
            overscanRowCount={3}
          />
        )}
      </AutoSizer>
    </div>
  );
}

export default OrdersList; 