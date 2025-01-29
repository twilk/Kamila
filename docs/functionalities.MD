# Kamila - DARWINA.PL Chrome Extension Functionalities

## Core Functionalities Overview

### 1. Order Management System
- **API Integration**: Fetches data from `darwina.pl/api/orders`
- **Store-based Filtering**:
  - ALL: Shows data for all stores
  - Specific Store: Filters data for selected store
- **Status Tracking**:
  - New Orders (Status: 1)
  - Confirmed Orders (Status: 2)
  - Accepted Orders (Status: 3)
  - Ready for Pickup (Status: READY)
  - Overdue Orders (>14 days)
- **Auto-refresh**: Updates every 5 minutes
- **Manual Refresh**: Available through UI button

### 2. DRWN Lead Management
- **Source**: Excel sheet data
- **Location**: DRWN tab
- **Features**:
  - Lead tracking
  - Status management
  - Historical data

### 3. Ranking System
- **Source**: Excel sheet data
- **Features**:
  - Position-based ranking
  - No numerical indicators
  - Clear position tracking
  - Reader-friendly format

## Technical Implementation

### 1. Core Services
- **Initialization Chain**:
  1. Core Services (InitLogger, MetricsManager, etc.)
  2. Base Managers (InitialLoadingManager, OperationProgressManager, etc.)
  3. Feature Managers (DataManager, StatusManager, etc.)
  4. UI Components
  5. Status and Counter Initialization

- **Service Structure**:
  ```
  services/
  ├── core/         # Core services
  ├── api/          # API services
  └── managers/     # Feature managers
  ```

### 2. Data Management
- **Store Management**:
  - Store selection validation
  - Store-specific data caching
  - Multi-store support

- **Cache System**:
  - Intelligent caching
  - Cache invalidation
  - Fallback mechanisms

- **Error Handling**:
  - Retry logic (max 3 attempts)
  - Graceful degradation
  - Error recovery
  - User notifications

### 3. Update Mechanisms
- **Automatic Updates**:
  - New orders check (1 min)
  - Counter updates (5 min)
  - Status changes (5 min)
  - Cache updates (5 min)
  - Data validation (15 min)

- **Manual Updates**:
  - Refresh button
  - Store change triggers
  - Filter updates

## Current Status

### 1. Implemented Features ✅
- Core services structure
- Basic error handling
- Cache management
- Loading indicators
- Order status tracking
- Store selection
- Manual refresh
- Auto-refresh
- Basic UI

### 2. In Progress 🔄
- API service reorganization
- Connection management improvements
- Error recovery strategies
- Storage optimization
- Performance enhancements

### 3. Planned Features 📋
- Enhanced offline support
- Better data validation
- Performance optimizations
- Advanced error recovery
- Storage migration system
- Improved testing coverage
- Developer tools
- Security improvements

## Performance Targets

### 1. Response Times
- Storage operations: <100ms
- Cache hit ratio: >80%
- Cleanup operations: <1s
- Migration time: <5s

### 2. Resource Usage
- Storage quota warning: 80%
- Critical threshold: 90%
- Cleanup batch size: 50 items
- Lock timeout: 5s

## Testing Requirements

### 1. Coverage Targets
- Unit tests: >90%
- Integration tests: >80%
- Performance benchmarks
- 24h stress test survival

### 2. Test Areas
- API connection
- Authorization
- Storage access
- Required permissions
- Order processing
- Cache operations
- Message communication
- Error handling
- Status processing

## Known Issues and Priorities

### High Priority
1. Storage System
   - Migration script needed
   - Version tracking
   - Automatic migration
   - Rollback capability

2. Performance
   - Batch operations
   - Data compression
   - Cleanup strategies
   - Monitoring system

3. Error Handling
   - Automatic recovery
   - Data integrity
   - Backup system
   - Error reporting

### Medium Priority
1. Cache Management
   - Invalidation strategy
   - Smart cleanup
   - Usage tracking
   - Hit ratio improvement

2. Analytics
   - Usage tracking
   - Performance metrics
   - Storage analytics
   - User behavior tracking

### Low Priority
1. Documentation
   - API documentation
   - Best practices
   - Troubleshooting guide
   - Recovery procedures

2. Developer Tools
   - Debugging tools
   - Inspection UI
   - Cleanup utilities
   - Development features 