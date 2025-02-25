/**
 * Process orders data
 * @param {Array} orders Orders to process
 */
function processOrders(orders) {
  console.log('💩 [WORKER] Processing orders:', orders.length);
  
  // Add any heavy computations here
  const processed = orders.map(order => {
    const isOverdue = checkIfOverdue(order);
    console.log('💩 [WORKER] Processing order:', {
      id: order.id,
      status: order.status_id,
      ready_date: order.ready_date,
      isOverdue
    });
    return {
      ...order,
      isOverdue,
      totalValue: calculateTotalValue(order),
      priority: calculatePriority(order)
    };
  });
  
  console.log('💩 [WORKER] Orders processed:', {
    total: processed.length,
    overdue: processed.filter(o => o.isOverdue).length,
    ready: processed.filter(o => o.status_id === '5' && !o.isOverdue).length
  });
  return processed;
}

/**
 * Calculate order statistics
 * @param {Array} orders Orders to analyze
 */
function calculateOrderStats(orders) {
  console.log('💩 [WORKER] Calculating stats for orders:', orders.length);
  
  // Najpierw przetwórz zamówienia żeby mieć isOverdue
  const processedOrders = processOrders(orders);
  
  console.log('💩 [WORKER] Calculating status counts...');
  // Potem licz statystyki na przetworzonych danych
  const statusCounts = processedOrders.reduce((acc, order) => {
    const status = order.status_id;
    console.log('💩 [WORKER] Counting order:', {
      id: order.id,
      status,
      isOverdue: order.isOverdue
    });
    
    if (status === '5') {
      // Dla statusu 5 rozdziel na ready/overdue
      if (order.isOverdue) {
        acc['overdue'] = (acc['overdue'] || 0) + 1;
        console.log('💩 [WORKER] Counted as overdue');
      } else {
        acc['ready'] = (acc['ready'] || 0) + 1;
        console.log('💩 [WORKER] Counted as ready');
      }
    } else {
      // Dla pozostałych statusów licz normalnie
      acc[status] = (acc[status] || 0) + 1;
      console.log('💩 [WORKER] Counted as status:', status);
    }
    return acc;
  }, {});

  console.log('💩 [WORKER] Status counts calculated:', statusCounts);

  const stats = {
    totalOrders: processedOrders.length,
    totalValue: processedOrders.reduce((sum, order) => sum + order.totalValue, 0),
    averageValue: processedOrders.reduce((sum, order) => sum + order.totalValue, 0) / processedOrders.length,
    statusCounts,
    overdueCount: processedOrders.filter(order => order.isOverdue).length
  };

  console.log('💩 [WORKER] Stats calculated:', stats);
  return stats;
}

/**
 * Check if order is overdue
 * @param {Object} order Order to check
 */
function checkIfOverdue(order) {
  if (!order.ready_date) return false;
  
  const readyDate = new Date(order.ready_date);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return readyDate < twoWeeksAgo;
}

/**
 * Calculate total value of order
 * @param {Object} order Order to calculate
 */
function calculateTotalValue(order) {
  return order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
}

/**
 * Calculate order priority
 * @param {Object} order Order to evaluate
 */
function calculatePriority(order) {
  let score = 0;
  
  // Add priority based on status
  switch (order.status_id) {
    case '1': // New
      score += 3;
      break;
    case '2': // Confirmed
      score += 2;
      break;
    case '3': // Accepted
      score += 1;
      break;
  }
  
  // Add priority for overdue orders
  if (checkIfOverdue(order)) {
    score += 5;
  }
  
  // Add priority based on value
  const value = calculateTotalValue(order);
  if (value > 1000) score += 2;
  if (value > 5000) score += 3;
  
  return score;
}

// Handle worker messages
self.onmessage = function(e) {
  const { orders, type } = e.data;
  console.log('💩 [WORKER] Received message:', { type, ordersCount: orders?.length });
  
  switch (type) {
    case 'PROCESS_ORDERS':
      console.log('💩 [WORKER] Processing orders...');
      const processed = processOrders(orders);
      console.log('💩 [WORKER] Sending processed orders back');
      self.postMessage({ type: 'PROCESSED_ORDERS', data: processed });
      break;
      
    case 'CALCULATE_STATS':
      console.log('💩 [WORKER] Calculating stats...');
      const stats = calculateOrderStats(orders);
      console.log('💩 [WORKER] Sending stats back');
      self.postMessage({ type: 'STATS_CALCULATED', data: stats });
      break;
  }
}; 