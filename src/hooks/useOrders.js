import { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { unstable_batchedUpdates } from 'react-dom';
import { OrdersService } from '../services/api/OrderService';

/**
 * Custom hook for managing orders with optimizations
 * @param {string} statusId Status ID to filter orders
 * @param {Object} dateRange Date range for filtering
 * @param {string} dateRange.start Start date
 * @param {string} dateRange.end End date
 */
function useOrders(statusId, dateRange) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [counts, setCounts] = useState({});
  
  // Create memoized instances
  const ordersService = useMemo(() => new OrdersService(), []);
  const worker = useMemo(() => new Worker('/workers/ordersWorker.js'), []);
  
  // Debounced fetch function
  const debouncedFetch = useMemo(
    () => debounce(ordersService.loadOrders, 300),
    [ordersService]
  );
  
  // Handle worker messages
  useEffect(() => {
    worker.onmessage = (e) => {
      const { type, data } = e.data;
      
      switch (type) {
        case 'PROCESSED_ORDERS':
          unstable_batchedUpdates(() => {
            setOrders(data);
            setLoading(false);
            
            // Po przetworzeniu zamówień, oblicz statystyki
            worker.postMessage({
              type: 'CALCULATE_STATS',
              orders: data // Użyj przetworzonych danych!
            });
          });
          break;
          
        case 'STATS_CALCULATED':
          unstable_batchedUpdates(() => {
            setCounts(data.statusCounts);
          });
          break;
      }
    };
    
    return () => worker.terminate();
  }, [worker]);
  
  // Main effect for loading orders
  useEffect(() => {
    let mounted = true;
    
    async function loadOrders() {
      if (!statusId || !dateRange) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const result = await debouncedFetch(
          statusId, 
          dateRange,
          (progress) => {
            if (mounted) {
              setProgress(progress);
            }
          }
        );
        
        if (mounted) {
          // Najpierw przetwórz zamówienia
          worker.postMessage({
            type: 'PROCESS_ORDERS',
            orders: result
          });
          // Statystyki będą obliczone po przetworzeniu
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    
    loadOrders();
    
    return () => {
      mounted = false;
      debouncedFetch.cancel();
    };
  }, [statusId, dateRange, debouncedFetch, worker]);
  
  return { 
    orders, 
    loading, 
    error, 
    progress,
    counts,
    refresh: () => {
      debouncedFetch.cancel();
      loadOrders();
    }
  };
}

export default useOrders; 