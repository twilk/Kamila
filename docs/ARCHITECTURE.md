# Kamila - System Architecture

## Overview

Kamila is a Chrome Extension designed to serve as an Intelligent Assistant for DARWINA.PL. The system follows a modular architecture with clear separation of concerns and robust error handling.

## Core Components

### 1. Service Layer

#### 1.1 Core Services
```typescript
// Base service structure
class BaseService {
    protected static instance: BaseService;
    protected constructor() {}
    public static getInstance(): BaseService {
        if (!BaseService.instance) {
            BaseService.instance = new BaseService();
        }
        return BaseService.instance;
    }
}
```

#### 1.2 Key Managers
- **MenuManager**: Handles UI navigation and state
- **InitializationManager**: Controls startup sequence
- **CacheManager**: Manages data caching
- **StoreManager**: Handles store-related operations
- **NotificationManager**: Manages system notifications

### 2. Data Flow

#### 2.1 API Integration
```typescript
interface APIRequest {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    params?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
}

interface APIResponse<T> {
    data: T;
    metadata: {
        timestamp: number;
        status: number;
        message: string;
    };
}

// Order status constants
const ORDER_STATUSES = {
    NEW: '1',
    CONFIRMED: '2',
    ACCEPTED: '3',
    READY_FOR_PICKUP: '5'
} as const;

// Counter keys
const COUNTER_KEYS = {
    NEW: '1',
    CONFIRMED: '2',
    ACCEPTED: '3',
    READY: 'READY',
    OVERDUE: 'OVERDUE'
} as const;
```

#### 2.2 Cache Structure
```typescript
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expires: number;
    metadata: {
        source: 'api' | 'cache';
        version: string;
        storeId?: string;
    };
}

interface CounterCache {
    counts: {
        '1': number;      // NEW
        '2': number;      // CONFIRMED
        '3': number;      // ACCEPTED
        'READY': number;  // Status 5 (< 2 weeks)
        'OVERDUE': number; // Status 5 (>= 2 weeks)
    };
    metadata: {
        initialFetch: boolean;
        lastUpdate: number;
        storeId: string;
    };
}

interface OrderData {
    order_id: string;
    status_id: string;
    created_at: string;
    modified_at: string;
    ready_date?: string;
}
```

### 3. Event System

#### 3.1 Custom Events
```typescript
interface CustomEvent {
    type: string;
    data: unknown;
    timestamp: number;
    source: string;
}

// Event types
const EVENT_TYPES = {
    STORE_CHANGED: 'store:changed',
    DATA_UPDATED: 'data:updated',
    CACHE_INVALIDATED: 'cache:invalidated',
    ERROR_OCCURRED: 'error:occurred',
    COUNTER_UPDATED: 'counter:updated',
    STORE_SELECTED: 'store:selected'
} as const;
```

#### 3.2 Event Handling
```typescript
class EventManager {
    private listeners: Map<string, Function[]>;
    
    public addEventListener(type: string, callback: Function): void;
    public removeEventListener(type: string, callback: Function): void;
    public dispatchEvent(event: CustomEvent): void;
}
```

## System Flow

### 1. Counter System Flow
1. User selects store or triggers refresh
2. Check cache validity
3. If cache invalid or force refresh:
   ```typescript
   // First request
   if (!hasInitialData) {
       // Get all orders
       params = { status_id: statusIds };
   } else {
       // Get only updates
       params = {
           status_id: statusIds,
           modified_from: lastUpdate
       };
   }
   ```
4. Process API response:
   ```typescript
   // Count orders by status
   const counts = {
       '1': 0, '2': 0, '3': 0,
       'READY': 0, 'OVERDUE': 0
   };
   
   orders.forEach(order => {
       const status = order.status_id?.toString();
       if (!status) return;
       
       if (status === '5') {
           const dateToCheck = order.ready_date || order.modified_at;
           const orderDate = new Date(dateToCheck);
           const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
           
           if (orderDate < twoWeeksAgo) {
               counts.OVERDUE++;
           } else {
               counts.READY++;
           }
       } else if (status in ['1', '2', '3']) {
           counts[status]++;
       }
   });
   ```
5. Update cache and UI
6. Emit counter update event

### 2. Store Selection Flow
1. User selects store
2. Clear existing cache
3. Update store metadata
4. Trigger data refresh
5. Update UI state
6. Emit store change event

### 3. Error Handling
```typescript
interface ErrorResponse {
    code: string;
    message: string;
    details?: unknown;
    timestamp: number;
}

class ErrorHandler {
    public static handle(error: Error): ErrorResponse;
    public static log(error: ErrorResponse): void;
    public static notify(error: ErrorResponse): void;
}
```

## Security Measures

### 1. Data Protection
- All sensitive data is encrypted
- API keys stored securely
- Regular security audits

### 2. Request Validation
```typescript
interface RequestValidator {
    validateHeaders(headers: Record<string, string>): boolean;
    validateBody(body: unknown): boolean;
    validateParams(params: Record<string, string>): boolean;
}
```

## Performance Optimization

### 1. Caching Strategy
- 5-minute cache timeout
- Lazy loading of resources
- Cache invalidation on critical updates
- Store-specific cache entries

### 2. Resource Management
```typescript
interface ResourceLimits {
    maxCacheSize: number;
    maxRequests: number;
    timeout: number;
    retryAttempts: number;
}
```

## Testing Strategy

### 1. Counter System Tests
```typescript
describe('Counter System', () => {
    it('should correctly count orders by status', () => {
        // Test status counting logic
    });
    
    it('should handle READY/OVERDUE classification', () => {
        // Test date-based classification
    });
    
    it('should properly update cache', () => {
        // Test cache update mechanism
    });
});
```

### 2. Store Selection Tests
```typescript
describe('Store Selection', () => {
    it('should handle store change correctly', () => {
        // Test store change flow
    });
    
    it('should clear cache on store change', () => {
        // Test cache clearing
    });
    
    it('should update UI state', () => {
        // Test UI updates
    });
});
```

### 3. API Integration Tests
```typescript
describe('API Integration', () => {
    it('should handle pagination correctly', () => {
        // Test pagination
    });
    
    it('should retry failed requests', () => {
        // Test retry mechanism
    });
    
    it('should validate response data', () => {
        // Test data validation
    });
});
```

## Monitoring and Logging

### 1. Performance Metrics
```typescript
interface Metrics {
    apiLatency: number;
    cacheHitRate: number;
    errorRate: number;
    memoryUsage: number;
    counterUpdateTime: number;
    storeChangeTime: number;
}
```

### 2. Log Levels
```typescript
enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    FATAL = 'fatal'
}
```

## Future Considerations

### 1. Scalability
- Microservices architecture
- Distributed caching
- Load balancing

### 2. Maintainability
- Code documentation
- Performance monitoring
- Automated testing

### 3. Extensibility
- Plugin system
- API versioning
- Feature flags 
