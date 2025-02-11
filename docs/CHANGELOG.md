# Changelog

All notable changes to the Kamila project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New cache structure with metadata:
  ```typescript
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
  ```
- Improved error handling in API calls with retry mechanism
- Enhanced store selection functionality with proper event handling
- Better date handling for READY/OVERDUE status:
  ```typescript
  const dateToCheck = order.ready_date || order.modified_at || order.created_at;
  const orderDate = new Date(dateToCheck);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  ```
- Comprehensive logging system with performance metrics
- New event types for better state management:
  ```typescript
  const EVENT_TYPES = {
      STORE_CHANGED: 'store:changed',
      DATA_UPDATED: 'data:updated',
      CACHE_INVALIDATED: 'cache:invalidated',
      ERROR_OCCURRED: 'error:occurred',
      COUNTER_UPDATED: 'counter:updated',
      STORE_SELECTED: 'store:selected'
  } as const;
  ```

### Changed
- Refactored counter system logic to handle edge cases
- Updated store change event handling with cache invalidation
- Optimized API request flow with proper pagination
- Improved cache invalidation mechanism with metadata tracking
- Enhanced UI/UX elements with loading states
- Modified status counting logic:
  ```typescript
  // Old implementation
  orders.forEach(order => counts[order.status_id]++);
  
  // New implementation
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

### Fixed
- Status counting logic in MenuManager with proper date handling
- Delivery ID filtering issues in store selection
- Cache invalidation problems with proper metadata tracking
- Date handling inconsistencies in READY/OVERDUE classification
- Event handler duplication in store selection
- First request issue with modified_from parameter:
  ```typescript
  // Old implementation
  if (!options.forceRefresh) {
      const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
      if (lastUpdate) {
          params.modified_from = lastUpdate;
      }
  }
  
  // New implementation
  if (!options.forceRefresh && this.#hasInitialData) {
      const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
      if (lastUpdate) {
          params.modified_from = lastUpdate;
      }
  }
  ```

### Removed
- Deprecated cache structure without metadata
- Old event handling system without proper typing
- Legacy API integration methods without pagination
- Outdated documentation files moved to docs/old/
- Redundant status mapping:
  ```typescript
  // Removed
  const STATUS_MAP = {
      '1': 'new',
      '2': 'confirmed',
      '3': 'accepted',
      '5': 'ready'
  };
  
  // Now using
  const ORDER_STATUSES = {
      NEW: '1',
      CONFIRMED: '2',
      ACCEPTED: '3',
      READY_FOR_PICKUP: '5'
  } as const;
  ```

## [1.0.0] - 2024-03-XX

### Added
- Initial release of Kamila
- Basic counter functionality
- Store selection feature
- API integration
- Cache management
- UI/UX elements

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Removed
- N/A (initial release)

## Types of changes
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities. 