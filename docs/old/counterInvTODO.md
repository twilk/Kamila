# 🥷 QA NINJA ENGINEER'S ACTION PLAN

## 🎯 Critical Issues

### 1. Counter Calculation Mismatch
```javascript
// PROBLEM: Different counting logic between implementations
// OLD (Working):
counts[order.status_id]++;

// NEW (Broken):
if (status === ORDER_STATUSES.READY_FOR_PICKUP) {
    // Complex logic that might be causing issues
}

// ACTION ITEMS:
// 1. Revert to simple counting mechanism
// 2. Add validation for status_id
// 3. Implement status mapping after counting
```

### 2. Status Mapping
```javascript
// PROBLEM: Inconsistent status mapping
// OLD (Working):
const STATUS_MAP = {
    '1': 'new',
    '2': 'confirmed',
    '3': 'accepted',
    '5': 'ready'
};

// NEW (Potentially Problematic):
const ORDER_STATUS_NAMES = {
    [ORDER_STATUSES.NEW]: 'Nowe',
    [ORDER_STATUSES.CONFIRMED]: 'Potwierdzone telefonicznie przez sklep',
    // ...
};

// ACTION ITEMS:
// 1. Standardize status mapping
// 2. Separate display names from status codes
// 3. Add validation layer
```

## 🔄 Immediate Actions Required

### 1. API Response Validation
- [ ] Add logging for raw API response
- [ ] Validate status_id presence
- [ ] Compare response format with old implementation

### 2. Counter Logic Refactor
- [ ] Update new counting mechanism to reflect old logic

### 3. Cache Management
- [ ] Review cache structure
- [ ] Add cache validation
- [ ] Implement proper cache invalidation
- [ ] Add cache debugging tools

### 4. Status Mapping
- [ ] Create unified status mapping
- [ ] Separate display names
- [ ] Add validation layer
- [ ] Implement fallback values

## 🧪 Test Cases to Implement

### 1. Counter Validation
```javascript
describe('Counter Logic', () => {
    test('should count status 1 correctly', () => {
        // Test implementation
    });
    test('should count status 2 correctly', () => {
        // Test implementation
    });
    // ...
});
```

### 2. Status Mapping
```javascript
describe('Status Mapping', () => {
    test('should map all known statuses', () => {
        // Test implementation
    });
    test('should handle unknown statuses', () => {
        // Test implementation
    });
});
```

## 🔍 Menu Tab Investigation

### 1. Event Handling
- [ ] Review event listener implementation
- [ ] Check event propagation
- [ ] Verify event handler binding
- [ ] Test event lifecycle

### 2. State Management
- [ ] Review state updates
- [ ] Check state persistence
- [ ] Verify state synchronization
- [ ] Test state transitions

### 3. CSS Classes
- [ ] Review class manipulation
- [ ] Check selector specificity
- [ ] Verify class application
- [ ] Test style changes

## 📊 Progress Tracking

```
[Critical Issues]
🔴 Counter Calculation: 0%
🔴 Status Mapping: 0%
🔴 Cache Management: 0%

[Menu Tab Issue]
🔴 Event Handling: 0%
🔴 State Management: 0%
🔴 CSS Classes: 0%
```

## 🎯 Next Steps

1. Implement logging for API responses
2. Create test suite for counter logic
3. Refactor status mapping
4. Add cache validation
5. Fix menu tab switching

## 📝 Notes for Implementation

### Counter Logic
```javascript
// Proposed implementation
function countOrders(orders) {
    const counts = {
        '1': 0,
        '2': 0,
        '3': 0,
        '5': 0
    };
    
    orders.forEach(order => {
        const status = order.status_id?.toString();
        if (status && status in counts) {
            counts[status]++;
        }
    });
    
    return counts;
}
```

### Status Mapping
```javascript
// Proposed implementation
const STATUS_MAPPING = {
    codes: {
        '1': 'new',
        '2': 'confirmed',
        '3': 'accepted',
        '5': 'ready'
    },
    display: {
        'new': 'Nowe',
        'confirmed': 'Potwierdzone',
        'accepted': 'Przyjęte',
        'ready': 'Gotowe'
    }
};
```

## 🔄 Daily Tasks

### Day 1
- [ ] Set up logging for API responses
- [ ] Create basic test suite
- [ ] Review old implementation
- [ ] Document differences

### Day 2
- [ ] Implement counter logic
- [ ] Add status mapping
- [ ] Create validation layer
- [ ] Test with real data

### Day 3
- [ ] Fix cache management
- [ ] Add error handling
- [ ] Implement monitoring
- [ ] Document changes

## 🚨 High Priority Fixes

### 1. Initial Data Load Fix
```javascript
// Implementation Plan
class OrderService {
    #hasInitialData = false;
    
    async fetchOrders(storeId = 'ALL', options = {}) {
        const params = new URLSearchParams();
        
        // Add base filters
        params.append('status_id', API_DEFAULTS.STATUSES);
        
        // Add store filter if needed
        if (storeId !== 'ALL' && stores[storeId]?.deliveryId) {
            params.append('delivery_id', stores[storeId].deliveryId);
        }
        
        // Only add modified_from for subsequent requests
        if (!options.forceRefresh && this.#hasInitialData) {
            const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
            if (lastUpdate) {
                params.append('modified_from', lastUpdate);
            }
        }
        
        // After successful fetch
        this.#hasInitialData = true;
    }
}
```

### 2. Status Counting Fix
```javascript
// Implementation Plan
function processOrders(orders) {
    const counts = {
        '1': 0,
        '2': 0,
        '3': 0,
        'READY': 0,
        'OVERDUE': 0
    };
    
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    orders.forEach(order => {
        const status = order.status_id?.toString();
        if (!status) {
            console.warn('Order without status:', order);
            return;
        }
        
        if (status === '5') {
            // Priority: ready_date > status_change_date > modified_at > created_at
            const dateToCheck = order.ready_date || 
                              order.status_change_date || 
                              order.modified_at || 
                              order.created_at;
                              
            const orderDate = new Date(dateToCheck);
            if (isNaN(orderDate.getTime())) {
                console.warn('Invalid date for order:', order);
                counts.READY++; // Default to READY if date is invalid
                return;
            }
            
            if (now - orderDate.getTime() > TWO_WEEKS) {
                counts.OVERDUE++;
            } else {
                counts.READY++;
            }
        } else if (['1', '2', '3'].includes(status)) {
            counts[status]++;
        }
    });
    
    return counts;
}
```

### 3. Cache Structure Update
```javascript
// Implementation Plan
const CACHE_SCHEMA = {
    counts: {
        '1': 'number',
        '2': 'number',
        '3': 'number',
        'READY': 'number',
        'OVERDUE': 'number'
    },
    metadata: {
        initialFetch: 'boolean',
        lastUpdate: 'number',
        storeId: 'string'
    }
};

function validateCache(cache) {
    if (!cache || typeof cache !== 'object') return false;
    
    // Validate counts
    for (const [key, type] of Object.entries(CACHE_SCHEMA.counts)) {
        if (typeof cache.counts?.[key] !== type) return false;
    }
    
    // Validate metadata
    for (const [key, type] of Object.entries(CACHE_SCHEMA.metadata)) {
        if (typeof cache.metadata?.[key] !== type) return false;
    }
    
    return true;
}
```

## 📋 Implementation Checklist

### Phase 1: Initial Data Load
- [ ] Add `#hasInitialData` flag to OrderService
- [ ] Update fetchOrders to handle first request differently
- [ ] Add logging for request parameters
- [ ] Test initial data load without modified_from

### Phase 2: Status Counting
- [ ] Implement new processOrders function
- [ ] Add date field priority handling
- [ ] Add validation for status values
- [ ] Add logging for problematic orders

### Phase 3: Cache Management
- [ ] Update cache schema
- [ ] Implement cache validation
- [ ] Add metadata tracking
- [ ] Test cache invalidation

## 🧪 Test Scenarios

### Initial Load Test
```javascript
test('should not use modified_from on first request', async () => {
    const service = new OrderService();
    const params = await service.getRequestParams();
    expect(params.has('modified_from')).toBe(false);
});
```

### Status Counting Test
```javascript
test('should correctly count status 5 orders', () => {
    const orders = [
        { status_id: '5', ready_date: new Date() },
        { status_id: '5', ready_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
    ];
    
    const counts = processOrders(orders);
    expect(counts.READY).toBe(1);
    expect(counts.OVERDUE).toBe(1);
});
```

## 📊 Updated Progress Tracking

```
[Critical Issues]
🟡 Initial Data Load: 0%
🟡 Status Counting: 0%
🟡 Cache Structure: 0%

[Validation]
🔴 Request Parameters: 0%
🔴 Status Processing: 0%
🔴 Cache Validation: 0%
```

## 🎯 Next Actions
1. Implement Initial Data Load fix
2. Test with real API data
3. Verify status counting
4. Update cache structure
5. Add comprehensive logging

[Implementation in Progress...]

## 🔍 Comparative Analysis Tasks

### 1. Old Implementation Review (C:\Users\Wilk\Downloads\Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042)
- [ ] Clone and set up old version
- [ ] Document old implementation's structure
- [ ] Extract key components:
  - [ ] Storage implementation
  - [ ] Counter logic
  - [ ] Status mapping
  - [ ] Menu handling

### 2. Code Comparison
- [ ] Storage Layer
  - [ ] Compare storage keys
  - [ ] Compare data structures
  - [ ] Document differences
- [ ] Counter Logic
  - [ ] Compare counting algorithms
  - [ ] Compare status handling
  - [ ] Document edge cases
- [ ] Menu System
  - [ ] Compare event handling
  - [ ] Compare state management
  - [ ] Document UI differences

### 3. Testing Strategy
- [ ] Set up parallel testing environment
- [ ] Create test data sets
- [ ] Implement comparison tests
- [ ] Document test results

## 📊 Progress Tracking

```
[Comparative Analysis]
🔴 Old Implementation Review: 0%
🔴 Code Comparison: 0%
🔴 Testing Strategy: 0%

[Critical Issues]
🔴 Counter Calculation: 0%
🔴 Status Mapping: 0%
🔴 Cache Management: 0%

[Menu Tab Issue]
🔴 Event Handling: 0%
🔴 State Management: 0%
🔴 CSS Classes: 0%
```

## 🎯 Next Steps

1. Set up old implementation environment
2. Create comparison documentation
3. Implement parallel testing
4. Analyze differences
5. Fix identified issues

## 📝 Daily Tasks

### Day 1: Setup and Initial Analysis
- [ ] Clone old repository
- [ ] Set up development environment
- [ ] Document initial differences
- [ ] Create comparison framework

### Day 2: Deep Dive
- [ ] Analyze storage implementation
- [ ] Compare counter logic
- [ ] Test menu functionality
- [ ] Document findings

### Day 3: Testing and Fixes
- [ ] Run parallel tests
- [ ] Identify critical differences
- [ ] Implement fixes
- [ ] Validate changes

## 🔍 Investigation Areas

### Storage Layer
- [ ] Compare storage keys
- [ ] Analyze cache structure
- [ ] Check cleanup logic
- [ ] Test quota management

### Counter Logic
- [ ] Compare status mapping
- [ ] Test edge cases
- [ ] Verify calculations
- [ ] Document differences

### Menu System
- [ ] Test tab switching
- [ ] Check event handling
- [ ] Verify state management
- [ ] Compare CSS handling

## 📋 Notes
- Keep both implementations running in parallel
- Document all differences systematically
- Focus on one component at a time
- Maintain detailed logs of findings 