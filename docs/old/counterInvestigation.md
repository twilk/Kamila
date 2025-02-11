🔍 TECH DETECTIVE'S JOURNAL: CASE #2024-03 - THE MYSTERIOUS COUNTER MISMATCH

## Case Overview
**Date**: March 2024
**Subject**: Counter discrepancy between old and new implementation
**Status**: Active Investigation
**Priority**: High

## Initial Observations
1. Old implementation (C:\Users\Wilk\Downloads\Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042) shows correct values
2. New implementation shows incorrect values but is functional
3. Both implementations use the same API
4. Menu tab switching issue may be related

## Investigation Plan
1. Compare API response handling
2. Analyze counter calculation logic
3. Investigate caching mechanisms
4. Review status mapping
5. Check data transformation pipeline

## Day 1 - Initial Analysis

### 10:00 AM - First Look at the Code
🔎 **Observation**: The new implementation has a more complex caching system
- Old implementation: Simple key-value storage
- New implementation: Structured cache with metadata

### 11:00 AM - Status Mapping Analysis
📊 **Key Finding**: Potential status mapping inconsistency
- Old implementation uses direct status IDs
- New implementation attempts to transform statuses

### 2:00 PM - Counter Calculation Deep Dive
🧮 **Critical Discovery**: Different counting logic
- Old: Direct count from API response
- New: Transformation before counting

### 4:00 PM - Cache Investigation
💾 **Important Note**: Cache structure differences
- Old: Flat structure with simple counters
- New: Nested structure with additional metadata

## Hypothesis Log

### Hypothesis #1: Status Mapping Mismatch
- **Status**: Under Investigation
- **Evidence**: Different status mapping implementations
- **Impact**: Could cause incorrect counter values

### Hypothesis #2: Cache Invalidation
- **Status**: Under Investigation
- **Evidence**: More complex cache structure in new version
- **Impact**: Might retain stale data

### Hypothesis #3: Data Transformation Pipeline
- **Status**: Under Investigation
- **Evidence**: Additional transformation steps in new version
- **Impact**: Potential data loss or corruption during transformation

## Evidence Collection

### Exhibit A: Status Mapping
```javascript
// Old Implementation
const STATUS_MAP = {
    '1': 'new',
    '2': 'confirmed',
    '3': 'accepted',
    '5': 'ready'
};

// New Implementation
const ORDER_STATUS_NAMES = {
    [ORDER_STATUSES.NEW]: 'Nowe',
    [ORDER_STATUSES.CONFIRMED]: 'Potwierdzone telefonicznie przez sklep',
    [ORDER_STATUSES.ACCEPTED]: 'Przyjęte do realizacji',
    [ORDER_STATUSES.READY_FOR_PICKUP]: 'Gotowe do odbioru'
};
```

### Exhibit B: Counter Logic
```javascript
// Old Implementation
orders.forEach(order => counts[order.status_id]++);

// New Implementation
if (status === ORDER_STATUSES.READY_FOR_PICKUP) {
    const orderDate = new Date(date.replace(' ', 'T'));
    if (orderDate < twoWeeksAgo) {
        counts[COUNTER_KEYS.OVERDUE]++;
    } else {
        counts[COUNTER_KEYS.READY]++;
    }
}
```

## Next Steps
1. Compare API response formats between implementations
2. Analyze the transformation pipeline in detail
3. Review cache invalidation logic
4. Test counter calculation with identical data sets

## Questions to Answer
1. Why does the new implementation transform status names?
2. Is the cache being properly invalidated?
3. Are we losing data during transformation?
4. Is the status mapping consistent with API response?

## Menu Tab Issue Investigation
🔍 **Initial Observation**: Menu tab switching failure
- Possible causes:
  1. Event handler not properly attached
  2. State management issue
  3. CSS class manipulation problem
  4. Route handling inconsistency

Will continue investigation...

## Day 2 - API Flow Investigation

### 9:00 AM - API Request Flow Analysis
🔍 **Critical Discovery**: First request vs subsequent requests
```javascript
// Expected behavior:
1. First request: NO modified_from parameter
   - Should get ALL orders with status_id in (1,2,3,5)
   - If store selected: Add delivery_id filter

2. Subsequent requests: WITH modified_from
   - Add modified_from based on last update timestamp
   - Keep other filters (status_id, delivery_id) unchanged
```

### 10:00 AM - Status Counting Pipeline
📊 **Flow Analysis**: Order status counting process
```javascript
// Expected Pipeline:
1. API Response
   {
     order_id: string,
     status_id: string, // '1', '2', '3', '5'
     created_at: string,
     modified_at: string,
     ready_date?: string
   }

2. Status Grouping
   - status '1' -> NEW counter
   - status '2' -> CONFIRMED counter
   - status '3' -> ACCEPTED counter
   - status '5' -> Check date:
     * if older than 2 weeks -> OVERDUE counter
     * if newer than 2 weeks -> READY counter

3. Counter Object
   {
     '1': number,      // NEW
     '2': number,      // CONFIRMED
     '3': number,      // ACCEPTED
     'READY': number,  // Status 5 (< 2 weeks)
     'OVERDUE': number // Status 5 (>= 2 weeks)
   }
```

### 11:00 AM - Code Review Findings
🔎 **Problem Areas Identified**:

1. **First Request Issue**
```javascript
// Current (Problematic):
if (!options.forceRefresh) {
    const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
    if (lastUpdate) {
        params.modified_from = lastUpdate;
    }
}

// Should Be:
if (!options.forceRefresh && this.#hasInitialData) {
    const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
    if (lastUpdate) {
        params.modified_from = lastUpdate;
    }
}
```

2. **Status Counting Issue**
```javascript
// Current (Problematic):
if (status === ORDER_STATUSES.READY_FOR_PICKUP) {
    try {
        const orderDate = new Date(date.replace(' ', 'T'));
        if (orderDate < twoWeeksAgo) {
            counts[COUNTER_KEYS.OVERDUE]++;
        } else {
            counts[COUNTER_KEYS.READY]++;
        }
    } catch (error) {
        counts[COUNTER_KEYS.READY]++;
    }
}

// Should Be:
const status = order.status_id?.toString();
if (!status) return;

if (status === '5') {
    const dateToCheck = order.ready_date || order.modified_at || order.created_at;
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
```

### 2:00 PM - Cache Analysis Update
💾 **Cache Structure Review**:
```javascript
// Current Cache Structure (Problematic):
{
    counts: {
        [COUNTER_KEYS.NEW]: Number(data.counts[COUNTER_KEYS.NEW]) || 0,
        [COUNTER_KEYS.CONFIRMED]: Number(data.counts[COUNTER_KEYS.CONFIRMED]) || 0,
        // ...
    }
}

// Should Be:
{
    counts: {
        '1': number,
        '2': number,
        '3': number,
        'READY': number,
        'OVERDUE': number
    },
    metadata: {
        initialFetch: boolean,
        lastUpdate: number,
        storeId: string
    }
}
```

## Updated Hypothesis

### Hypothesis #4: Initial Data Load
- **Status**: Confirmed
- **Evidence**: Missing check for initial data load
- **Impact**: Always using modified_from when it shouldn't on first load

### Hypothesis #5: Status Date Handling
- **Status**: Confirmed
- **Evidence**: Incorrect date field priority for status 5
- **Impact**: Wrong classification of READY/OVERDUE orders

## Action Items
1. Add `initialFetch` flag to track first load
2. Fix date field priority for status 5
3. Simplify status counting logic
4. Update cache structure
5. Add validation for status_id values

## Day 2 - Menu Tab Investigation

### 12:00 PM - Menu Tab Switching Analysis
🔍 **Added Detailed Logging**: Tracking menu tab lifecycle

#### Initialization Phase
```javascript
1. Bootstrap Loading Check
   - Wait for bootstrap with max 10 attempts
   - 500ms delay between attempts
   
2. Tab Elements Discovery
   - Query: '[data-bs-toggle="tab"]'
   - Log found elements with:
     - href attribute
     - data-target
     - CSS classes

3. Initial Active Tab
   - Default: '#chat'
   - Fallback to DOM: '.menu .link.active'
```

#### Click Event Phase
```javascript
1. Tab Click Detection
   - Previous tab state
   - New tab target
   - Bootstrap instance check
   - Target pane existence
   - Current CSS classes
```

#### Tab Switch Phase (show.bs.tab)
```javascript
1. Switch Initiation
   - Source tab details
   - Target tab details
   - Current active state
   - Event phase tracking
```

#### Tab Switch Completion (shown.bs.tab)
```javascript
1. State Updates
   - Previous active tab
   - New active tab
   - CSS class changes per menu item
   - Active tabs count verification

2. Event Emission
   - menu:tabChanged event
   - Timestamp tracking
   - Previous/current tab details
```

### Expected Behavior
1. Single tab should be active at any time
2. CSS classes should update correctly
3. Bootstrap Tab instance should exist
4. Target pane should be found
5. Events should fire in sequence:
   - click
   - show.bs.tab
   - shown.bs.tab

### Potential Issues
1. Multiple active tabs
2. Missing Bootstrap instance
3. Invalid target references
4. Event sequence disruption
5. CSS class inconsistency

Awaiting log data for analysis...

## Day 2 - Storage Implementation Analysis

### 3:00 PM - Storage Manager Review
🔍 **Storage Implementation Deep Dive**

#### Storage Structure
```javascript
// Data Storage Format
{
    value: any,            // Actual data
    timestamp: number,     // Creation/Update time
    lastAccess: number    // Last access time
}

// Key Storage Locations
1. darwina_cache         // Main cache
2. last_full_update      // Last update timestamp
3. darwina_store_${id}   // Store-specific data
```

#### Critical Components

1. **Lock Management**
```javascript
// Lock System
- Map of active locks
- Lock timeout (5 seconds)
- Auto-release mechanism
```

2. **Quota Management**
```javascript
// Storage Thresholds
- Warning: 80% usage
- Critical: 90% usage
- Cleanup batch: 50 items
```

3. **Cleanup Strategies**
```javascript
// Emergency Cleanup (>90% usage)
- Remove oldest items first
- Batch size: 50 items

// Normal Cleanup (>80% usage)
- Remove items older than 30 days
- Only triggered once per warning
```

#### Potential Issues

1. **Race Conditions**
```javascript
// Lock Acquisition
if (!await this.acquireLock(key)) {
    throw new Error('Storage operation in progress');
}
// What if process crashes before release?
```

2. **Data Integrity**
```javascript
// Metadata Wrapping
const dataWithMeta = {
    value: data,
    timestamp: Date.now(),
    lastAccess: Date.now()
};
// Are we always unwrapping correctly?
```

3. **Cache Invalidation**
```javascript
// Last Access Update
storedData.lastAccess = Date.now();
await chrome.storage.local.set({ [key]: storedData });
// Extra write operation on every read
```

4. **Error Handling**
```javascript
// Load Operation
catch (error) {
    console.warn(`[WARNING] ⚠️ Error loading from storage (${key}):`, error);
    return null;
}
// Silent failures could mask issues
```

### Storage-Related Hypotheses

#### Hypothesis #6: Lock Timeout Issues
- **Status**: Under Investigation
- **Evidence**: 5-second lock timeout might be too short for large operations
- **Impact**: Potential concurrent writes if operation exceeds timeout

#### Hypothesis #7: Cache Metadata Overhead
- **Status**: Under Investigation
- **Evidence**: Every cached item includes timestamp and lastAccess
- **Impact**: Reduced effective storage capacity, more frequent cleanups

#### Hypothesis #8: Silent Failure Cascade
- **Status**: Under Investigation
- **Evidence**: Some storage errors return null instead of throwing
- **Impact**: Could cause undefined behavior in dependent systems

### Action Items for Storage
1. Review lock timeout duration
2. Implement lock recovery mechanism
3. Audit metadata usage efficiency
4. Add storage operation metrics
5. Implement proper error propagation
6. Add storage state validation

### Questions to Investigate
1. Are locks being properly released?
2. Is metadata overhead affecting performance?
3. How often do emergency cleanups occur?
4. Are we losing critical data during cleanup?
5. Is the lastAccess update necessary on every read?

## Day 2 - Old Implementation Analysis

### 4:00 PM - Code Comparison Initialization
🔍 **Starting Comparative Analysis**: Examining old implementation at:
`C:\Users\Wilk\Downloads\Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042\Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042`

### 4:30 PM - Storage Implementation Comparison
🔍 **Key Differences Found**

#### 1. Cache Structure
```javascript
// Old Implementation (Simple)
{
    [key]: data,
    [`${key}_timestamp`]: Date.now()
}

// New Implementation (Complex)
{
    value: data,
    timestamp: Date.now(),
    lastAccess: Date.now()
}
```

#### 2. Cache Management
```javascript
// Old Implementation
- Simple expiration check
- No quota management
- Basic error handling
- No locks

// New Implementation
- Complex quota management
- Cleanup strategies
- Lock system
- Extensive error handling
```

#### 3. API Integration
```javascript
// Old Implementation (Simple Counting)
data.forEach(order => {
    switch(order.status_id) {
        case API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED.id:
            counts.submitted++;
            break;
        case API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED.id:
            counts.confirmed++;
            break;
        // ...
    }
});

// New Implementation (Complex Processing)
if (status === ORDER_STATUSES.READY_FOR_PICKUP) {
    const orderDate = new Date(date.replace(' ', 'T'));
    if (orderDate < twoWeeksAgo) {
        counts[COUNTER_KEYS.OVERDUE]++;
    } else {
        counts[COUNTER_KEYS.READY]++;
    }
}
```

### Critical Findings

1. **Simplicity vs Complexity**
   - Old: Direct key-value storage with timestamp
   - New: Nested structure with metadata and access tracking

2. **Error Handling**
   - Old: Basic error logging
   - New: Extensive error categorization and handling

3. **Cache Management**
   - Old: Simple expiration-based cleanup
   - New: Complex quota-based cleanup with multiple strategies

4. **Data Processing**
   - Old: Direct status counting
   - New: Status transformation with date-based logic

### Updated Action Items

1. **Simplify Storage Structure**
```javascript
// Proposed Hybrid Approach
{
    [key]: {
        data: value,
        timestamp: Date.now()
    }
}
```

2. **Optimize Cache Management**
```javascript
// Keep only essential features
- Basic expiration check
- Simple cleanup strategy
- Essential error handling
- Lightweight locking
```

3. **Streamline Counter Logic**
```javascript
// Return to simpler counting with validation
orders.forEach(order => {
    const status = order.status_id?.toString();
    if (status && status in counts) {
        counts[status]++;
    }
});
```

### 5:00 PM - API Configuration Analysis
🔍 **API Structure Comparison**

#### 1. Status Codes Definition
```javascript
// Old Implementation (Clear Mapping)
STATUS_CODES: {
    SUBMITTED: 1,        // Złożone
    CONFIRMED: 2,        // Potwierdzone przez Klienta
    ACCEPTED_STORE: 3,   // Przyjęte do realizacji w sklepie
    ACCEPTED_SHIPPING: 4, // Przyjęte do realizacji do wysyłki
    READY: 5,           // Gotowe do odbioru w sklepie
    PICKED_UP: 9,       // Towar odebrany w sklepie
    // ...
}

// New Implementation (Complex Mapping)
ORDER_STATUS_NAMES = {
    [ORDER_STATUSES.NEW]: 'Nowe',
    [ORDER_STATUSES.CONFIRMED]: 'Potwierdzone telefonicznie przez sklep',
    [ORDER_STATUSES.ACCEPTED]: 'Przyjęte do realizacji',
    [ORDER_STATUSES.READY_FOR_PICKUP]: 'Gotowe do odbioru'
}
```

#### 2. Status Processing
```javascript
// Old Implementation (Direct)
case API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED:
    counts.submitted++;
    break;

// New Implementation (Transformed)
if (status === ORDER_STATUSES.READY_FOR_PICKUP) {
    // Complex date-based logic
}
```

### Key Findings

1. **Status Definition**
   - Old: Clear 1:1 mapping with comments
   - New: Multiple mapping layers with translations

2. **Processing Logic**
   - Old: Direct status-to-counter mapping
   - New: Status transformation with additional logic

3. **Code Organization**
   - Old: Centralized configuration
   - New: Distributed across multiple files

### Impact Analysis

1. **Counter Calculation**
   - Old implementation correctly counts all statuses directly
   - New implementation adds complexity with date checks
   - Potential loss of accuracy in new implementation

2. **Status Mapping**
   - Old implementation maintains clear status meanings
   - New implementation might lose status context in translation
   - Risk of status mismatch in new implementation

### Recommended Changes

1. **Simplify Status Mapping**
```javascript
// Proposed Implementation
const STATUS_MAPPING = {
    codes: {
        '1': 'NEW',
        '2': 'CONFIRMED',
        '3': 'ACCEPTED',
        '5': 'READY'
    },
    display: {
        'NEW': 'Nowe',
        'CONFIRMED': 'Potwierdzone',
        'ACCEPTED': 'Przyjęte',
        'READY': 'Gotowe do odbioru'
    }
};
```

2. **Streamline Counter Logic**
```javascript
// Proposed Implementation
function countOrders(orders) {
    const counts = {
        NEW: 0,
        CONFIRMED: 0,
        ACCEPTED: 0,
        READY: 0,
        OVERDUE: 0
    };

    orders.forEach(order => {
        const status = STATUS_MAPPING.codes[order.status_id];
        if (!status) return;

        if (status === 'READY') {
            const date = order.ready_date || order.created_at;
            const orderDate = new Date(date);
            const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            
            counts[orderDate < twoWeeksAgo ? 'OVERDUE' : 'READY']++;
        } else {
            counts[status]++;
        }
    });

    return counts;
}
```

3. **Centralize Configuration**
```javascript
// Proposed Structure
/config
  ├── api.js        // API endpoints and base config
  ├── status.js     // Status definitions and mapping
  ├── counters.js   // Counter configuration
  └── display.js    // Display text and translations
```

[Investigation Continues...] 