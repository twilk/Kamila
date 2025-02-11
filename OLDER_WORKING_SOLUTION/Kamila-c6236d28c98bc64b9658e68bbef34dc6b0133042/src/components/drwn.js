function initializeDrwnTable() {
  // Wait for table to be ready
  const tableCheckInterval = setInterval(() => {
    const headers = document.querySelector('#drwn-headers');
    const body = document.querySelector('#drwn-body');
    
    if (!headers || !body) {
      return; // Table not ready yet
    }
    
    clearInterval(tableCheckInterval);

    // Modify header
    const firstHeader = headers.querySelector('th:nth-child(1)');
    if (firstHeader) {
      firstHeader.innerHTML = `
        <div class="order-header">
          <button class="order-button">Zamów</button>
          <span>KOD</span>
        </div>
      `;
    }

    // Add checkboxes to rows
    const rows = body.querySelectorAll('tr');
    rows.forEach(row => {
      const firstCell = row.querySelector('td:first-child');
      if (firstCell) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'product-checkbox';
        firstCell.insertBefore(checkbox, firstCell.firstChild);
      }
    });

    // Add order button click handler
    const orderButton = document.querySelector('.order-button');
    if (orderButton) {
      orderButton.addEventListener('click', () => {
        const selectedProducts = [];
        document.querySelectorAll('.product-checkbox:checked').forEach(checkbox => {
          const row = checkbox.closest('tr');
          const code = row.querySelector('td:first-child').textContent.trim();
          selectedProducts.push(code);
        });
        
        if (selectedProducts.length > 0) {
          console.log('Selected products:', selectedProducts);
          // TODO: Implement order handling logic
        } else {
          alert('Proszę wybrać produkty do zamówienia');
        }
      });
    }
  }, 500); // Check every 500ms
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDrwnTable);
} else {
  initializeDrwnTable();
} 