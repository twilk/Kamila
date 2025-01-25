# Backup Report: API Interactions and Data Flow Analysis

## 1. API Calls Analysis

### 1.1 API Request Parameters
- **Base URL**: `darwina.pl/api/orders`
- **Core Parameters**:
  - `status_id`: Always includes statuses [1,2,3,5] (submitted, confirmed, accepted, ready)
  - `limit`: Set to 50 records per page
  - `page`: Used for pagination

### 1.2 Store-Specific Parameters
- When store is "ALL":
  - No `delivery_id` parameter is added
  - Fetches all orders across stores
- When specific store is selected:
  - Adds `delivery_id` from store configuration
  - Filters orders for that specific store

### 1.3 Time-Based Parameters
- First Request:
  - No `modified_from` parameter
  - Fetches all relevant orders
- Subsequent Requests:
  - Includes `modified_from` based on last update timestamp
  - Only fetches orders modified since last update

## 2. Data Flow Analysis

### 2.1 API Response Processing
1. Initial Response:
   - Checks total pages from `__metadata.page_count`
   - Collects orders from first page
2. Pagination Handling:
   - Fetches remaining pages if any
   - Accumulates orders from all pages

### 2.2 Data Processing
1. Order Status Counting:
   ```javascript
   const counts = {
       '1': 0,  // SUBMITTED
       '2': 0,  // CONFIRMED
       '3': 0,  // ACCEPTED
       'READY': 0,
       'OVERDUE': 0
   };
   ```
2. Status Classification:
   - Status 5 (READY):
     - If order date > 2 weeks ago: counts as 'READY'
     - If order date < 2 weeks ago: counts as 'OVERDUE'
   - Statuses 1,2,3: counted directly

### 2.3 Data Storage
1. Cache Structure:
   ```javascript
   {
       'orderCounts': {
           data: counts,
           timestamp: now,
           storeId: store.id,
           metadata: response.metadata,
           orders: response.orders
       },
       'lastUpdate': now
   }
   ```
2. Cache Usage:
   - Cache key: `orders_${selectedStore}`
   - Cache validity: 5 minutes
   - Stores both counts and raw orders

## 3. Refresh Button Functionality

### 3.1 Normal Refresh
1. Checks cache age
2. If cache valid (< 5 min):
   - Uses cached data
   - Shows "Using cached data" message
3. If cache invalid:
   - Fetches new data from API
   - Updates cache and counters

### 3.2 Force Refresh
1. Bypasses cache check
2. Always fetches fresh data
3. Updates cache with new data
4. Updates UI counters

## 4. Store Selection Impact

### 4.1 Store Change Behavior
1. Clears existing cache
2. Triggers new API request
3. Updates URL parameters for filtered view

### 4.2 Store-Specific Features
- ALL Stores:
  - No delivery_id filter
  - Shows combined counts
- Specific Store:
  - Filters by delivery_id
  - Shows store-specific counts

## 5. Counter Display Logic

### 5.1 Counter Updates
1. Processes raw API data
2. Calculates counts by status
3. Updates UI elements with new counts
4. Adds click handlers for navigation

### 5.2 Counter Navigation
- Each counter is clickable
- Generates URL with appropriate filters:
  - Status filter
  - Store filter (if selected)
  - Date range for READY/OVERDUE 