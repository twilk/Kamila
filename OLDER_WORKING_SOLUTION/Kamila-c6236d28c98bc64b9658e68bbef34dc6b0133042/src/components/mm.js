class MMManager {
  constructor() {
    this.tasks = [];
    this.lastCheck = null;
    this.checkInterval = 5 * 60 * 1000; // 5 minutes
  }

  async initialize() {
    await this.checkNewOrders();
    this.startPeriodicCheck();
    this.renderTasks();
  }

  startPeriodicCheck() {
    setInterval(() => this.checkNewOrders(), this.checkInterval);
  }

  async checkNewOrders() {
    try {
      const response = await fetch('darwina.pl/api/orders', {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('apiToken')
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const orders = await response.json();
      await this.processOrders(orders);
      
      this.lastCheck = new Date();
    } catch (error) {
      console.error('Error checking orders:', error);
    }
  }

  async processOrders(orders) {
    for (const order of orders) {
      for (const item of order.items) {
        await this.checkProductAvailability(item, order.warehouse_id);
      }
    }
  }

  async checkProductAvailability(item, targetWarehouseId) {
    try {
      // Check target warehouse stock
      const targetStock = await this.getWarehouseStock(item.product_id, targetWarehouseId);
      
      if (targetStock >= item.quantity) return; // Stock available in target warehouse
      
      // Check other warehouses
      const allStocks = await this.getAllWarehousesStock(item.product_id);
      const sourceWarehouse = this.findBestSourceWarehouse(allStocks, targetWarehouseId, item.quantity);
      
      if (sourceWarehouse) {
        this.createTask(item, sourceWarehouse, targetWarehouseId);
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  }

  async getWarehouseStock(productId, warehouseId) {
    const response = await fetch(`darwina.pl/api/products/${productId}/warehouses/${warehouseId}`);
    const data = await response.json();
    return data.quantity || 0;
  }

  async getAllWarehousesStock(productId) {
    const response = await fetch(`darwina.pl/api/products/${productId}/warehouses`);
    return await response.json();
  }

  findBestSourceWarehouse(stocks, targetWarehouseId, requiredQuantity) {
    return stocks
      .filter(stock => 
        stock.warehouse_id !== targetWarehouseId && 
        stock.quantity >= requiredQuantity
      )
      .sort((a, b) => b.quantity - a.quantity)[0];
  }

  createTask(item, sourceWarehouse, targetWarehouseId) {
    const task = {
      id: `task_${Date.now()}`,
      productCode: item.product_id,
      productName: item.name,
      quantity: item.quantity,
      sourceStore: sourceWarehouse.warehouse_id,
      targetStore: targetWarehouseId,
      status: 'pending',
      createdAt: new Date()
    };

    this.tasks.push(task);
    this.renderTasks();
  }

  renderTasks() {
    const container = document.getElementById('mm-tasks-list');
    if (!container) return;

    container.innerHTML = this.tasks
      .map(task => `
        <div class="task-item" data-task-id="${task.id}">
          <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
          <div class="task-details">
            <div class="task-code">${task.productCode} - ${task.productName}</div>
            <div class="task-store">Ze sklepu ${task.sourceStore} do ${task.targetStore}</div>
            <div class="task-quantity">Ilość: ${task.quantity}</div>
          </div>
        </div>
      `)
      .join('');

    this.attachTaskListeners();
  }

  attachTaskListeners() {
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const taskId = e.target.closest('.task-item').dataset.taskId;
        if (e.target.checked) {
          alert('Tworzę plik (mock)');
          const task = this.tasks.find(t => t.id === taskId);
          if (task) {
            task.status = 'completed';
            this.renderTasks();
          }
        }
      });
    });
  }
}

// Initialize MM functionality
document.addEventListener('DOMContentLoaded', () => {
  const mmManager = new MMManager();
  mmManager.initialize();
}); 