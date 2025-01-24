# API Documentation 📚

## Core Managers API Reference

### 1. InitializationManager 🚀

The main coordinator for initializing all managers in the correct order.

```typescript
interface InitializationManager {
    // Initialize all managers on startup
    initializeOnStartup(): Promise<void>;
    
    // Initialize all managers on extension install/update
    initializeOnInstall(): Promise<void>;
    
    // Register a new manager
    registerManager(name: string, instance: BaseManager): void;
}
```

### 2. MessageManager 💬

Handles all application messages and notifications.

```typescript
interface MessageManager {
    // Show a message with specified type and content
    showMessage(options: {
        type: 'error' | 'warning' | 'info' | 'success';
        key: string;
        duration?: number;
    }): Promise<void>;
    
    // Hide a specific message
    hideMessage(element: HTMLElement): Promise<void>;
    
    // Hide all messages
    hideAllMessages(): Promise<void>;
}
```

### 3. StoreManager 🏪

Manages store selection and related operations.

```typescript
interface Store {
    id: string;
    name: string;
    address?: string;
    isActive?: boolean;
}

interface StoreManager {
    // Change current store
    changeStore(storeId: string): Promise<boolean>;
    
    // Get current store
    getCurrentStore(): Store | null;
    
    // Get all available stores
    getStores(): Map<string, Store>;
}
```

### 4. UIManager 🎨

Handles UI operations and updates.

```typescript
interface UIManager {
    // Safely update a single element
    safeUpdateElement(
        selector: string, 
        updateFn: (element: HTMLElement) => void
    ): void;
    
    // Safely update multiple elements
    safeUpdateElements(
        selector: string, 
        updateFn: (element: HTMLElement, index: number) => void
    ): void;
    
    // Handle UI-related errors
    handleError(
        error: Error,
        type?: ErrorType,
        severity?: ErrorSeverity,
        context?: object
    ): void;
}
```

### 5. DataManager 📊

Manages data operations and caching.

```typescript
interface DataManager {
    // Load and update data
    loadAndUpdateData(forceRefresh?: boolean): Promise<boolean>;
    
    // Get last update timestamp
    getLastUpdate(): number | null;
}
```

### 6. StatusManager 📈

Manages application status and order counters.

```typescript
interface OrderCounts {
    '1': number;      // submitted
    '2': number;      // confirmed
    '3': number;      // accepted
    'READY': number;  // ready for pickup
    'OVERDUE': number; // overdue
}

interface StatusManager {
    // Update order counts
    updateOrderCounts(counts: OrderCounts, animate?: boolean): Promise<void>;
    
    // Get current order counts
    getOrderCounts(): OrderCounts;
    
    // Update service status
    updateStatus(service: string, status: boolean | StatusObject): void;
    
    // Check all services
    checkAllServices(): Promise<void>;
}
```

## Common Patterns

### 1. Manager Initialization 🔄

All managers follow a common initialization pattern:

```typescript
class SomeManager extends BaseManager {
    async initialize(): Promise<boolean> {
        try {
            await super.initialize();
            // Manager-specific initialization
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION);
            return false;
        }
    }
}
```

### 2. Error Handling 🚨

Standard error handling pattern:

```typescript
handleError(
    error: Error,
    type: ErrorType,
    severity: ErrorSeverity,
    context: object
): void {
    this._errorHandler.handle(error, type, severity, {
        ...context,
        manager: this.constructor.name
    });
}
```

### 3. Event Communication 📡

Standard event pattern:

```typescript
// Emit event
window.dispatchEvent(new CustomEvent('event:name', {
    detail: { /* event data */ }
}));

// Listen for event
window.addEventListener('event:name', (event) => {
    const data = event.detail;
    // Handle event
});
```

## Usage Examples

### 1. Changing Store 🔄

```javascript
// Change store and handle UI updates
await storeManager.changeStore('store1');
```

### 2. Showing Messages 💬

```javascript
// Show success message
await messageManager.showMessage({
    type: 'success',
    key: 'operation.success',
    duration: 3000
});
```

### 3. Updating UI 🎨

```javascript
// Update counter element
uiManager.safeUpdateElement('#counter', (element) => {
    element.textContent = '5';
    element.classList.add('has-count');
});
```

### 4. Loading Data 📊

```javascript
// Force refresh data
await dataManager.loadAndUpdateData(true);
```

## Important Notes 📝

1. All managers are singletons - use `getInstance()` to get instance
2. Always handle async operations with try/catch
3. Use type-safe operations where possible
4. Follow error handling patterns
5. Use event-based communication between managers
6. Cache data when appropriate
7. Validate all input data 