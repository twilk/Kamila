# Counter System Repair Plan

## 1. API Request Fixes

### 1.1 Parameter Handling ⚠️ HIGH PRIORITY
- [ ] Fix `modified_from` parameter logic:
  - Should be omitted on first request
  - Should use last update timestamp for subsequent requests
- [ ] Correct `delivery_id` handling:
  - Only include when store is not "ALL"
  - Ensure proper store ID to delivery_id mapping

### 1.2 Response Processing 🔴 CRITICAL
- [ ] Implement proper pagination handling
- [ ] Ensure all pages are collected before processing
- [ ] Add proper error handling for failed page requests
- [ ] Add logging for API response data structure

## 2. Data Processing Fixes

### 2.1 Order Status Counting 🔴 CRITICAL
- [ ] Fix status classification logic:
  ```javascript
  // Verify this structure matches API response
  order.status_id?.toString()
  order.ready_date || order.status_change_date || order.modified_at
  ```
- [ ] Correct date handling for READY/OVERDUE classification
- [ ] Add validation for missing or invalid dates

### 2.2 Cache Management ⚠️ HIGH PRIORITY
- [ ] Implement proper cache structure:
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
- [ ] Add cache validation checks
- [ ] Implement cache cleanup for old data

## 3. UI Updates

### 3.1 Counter Display 🟡 MEDIUM PRIORITY
- [ ] Ensure counters update immediately after data fetch
- [ ] Add loading state during updates
- [ ] Implement error state display
- [ ] Add tooltips with status descriptions

### 3.2 Click Handlers ⚠️ HIGH PRIORITY
- [ ] Fix URL generation for each status
- [ ] Ensure proper store ID is passed
- [ ] Add date range parameters for READY/OVERDUE
- [ ] Implement proper window opening behavior

## 4. Store Selection

### 4.1 Store Change Handling 🟡 MEDIUM PRIORITY
- [ ] Clear cache on store change
- [ ] Trigger immediate data refresh
- [ ] Update UI to reflect loading state
- [ ] Handle errors during store change

### 4.2 Store-Specific Features ⚠️ HIGH PRIORITY
- [ ] Implement proper ALL stores handling
- [ ] Fix delivery_id filtering
- [ ] Add store validation
- [ ] Update URL parameters correctly

## 5. Testing Plan

### 5.1 API Integration Tests 🔴 CRITICAL
- [ ] Test first-time data load
- [ ] Test subsequent updates
- [ ] Test pagination
- [ ] Test error scenarios

### 5.2 Cache Tests ⚠️ HIGH PRIORITY
- [ ] Test cache storage
- [ ] Test cache retrieval
- [ ] Test cache invalidation
- [ ] Test force refresh

### 5.3 UI Tests 🟡 MEDIUM PRIORITY
- [ ] Test counter updates
- [ ] Test click handlers
- [ ] Test store selection
- [ ] Test error displays

## Priority Legend
- 🔴 CRITICAL: Must be fixed immediately
- ⚠️ HIGH: Should be fixed in next release
- 🟡 MEDIUM: Important but not urgent
- 🟢 LOW: Nice to have 