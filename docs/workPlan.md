# 📋 Orders Counter Fix Work Plan

## 🔄 Current Task: Manager Import Standardization
- [x] Fix imports in background.js to use standardized Instance suffixes
  - [x] logManagerInstance
  - [x] eventManagerInstance
  - [x] storageManagerInstance
  - [x] cacheManagerInstance
  - [x] alarmManagerInstance
  - [x] messageManagerInstance
  - [x] storeManagerInstance
  - [x] operationProgressManagerInstance
  - [x] notificationManagerInstance
  - [x] counterManagerInstance
  - [x] errorHandlerInstance

## 🎯 Overview
This work plan outlines the steps to fix specific issues in the orders counter system while maintaining the current optimized architecture. The focus is on ensuring proper data flow and fixing counter inconsistencies without compromising the system's modern features.

## 📊 Current Architecture Strengths
- ✅ Efficient event-driven architecture
- ✅ Optimized memory usage (15-20MB base)
- ✅ High cache performance (85% hit ratio)
- ✅ Fast UI response times (<16ms)
- ✅ Comprehensive error handling
- ✅ Robust dependency management

## 🔍 Identified Issues
1. **Data Flow**
   - Incomplete merging of API and cached data
   - Missing delta updates implementation
   - Status mapping inconsistencies

2. **Counter Updates**
   - Race conditions in counter increments
   - Missing validation in status transitions
   - Incomplete error recovery for failed updates

3. **Cache Management**
   - Cache invalidation timing issues
   - Missing version control in cache updates
   - Incomplete delta sync mechanism

## 🚀 Implementation Phases

### Phase 1: Data Flow Optimization (Week 1)
- [ ] **1.1 Enhance DataManager**
  ```javascript
  class DataManager extends BaseManager {
      async loadAndUpdateData(forceRefresh = false) {
          const cachedData = await this.#loadFromCache();
          const lastUpdate = cachedData?.timestamp || 0;
          
          // Get delta updates if cache exists
          const deltaUpdates = cachedData ? 
              await this.#fetchDeltaUpdates(lastUpdate) : 
              await this.#fetchFullData();
          
          // Merge with cache if exists
          const mergedData = cachedData ? 
              await this.#mergeData(cachedData.data, deltaUpdates) :
              deltaUpdates;
              
          await this.#updateCache(mergedData);
          await this.#updateCounters(mergedData);
      }
  }
  ```
- [ ] **1.2 Implement Delta Updates**
  ```javascript
  async #fetchDeltaUpdates(lastUpdate) {
      return await this.api.get('/orders', {
          params: { modified_from: lastUpdate }
      });
  }
  ```
- [ ] **1.3 Add Data Merging**
  ```javascript
  async #mergeData(cached, fresh) {
      const orderMap = new Map(
          cached.map(order => [order.id, order])
      );
      fresh.forEach(order => {
          orderMap.set(order.id, {
              ...orderMap.get(order.id),
              ...order,
              lastUpdate: Date.now()
          });
      });
      return Array.from(orderMap.values());
  }
  ```

### Phase 2: Counter Accuracy (Week 1-2)
- [ ] **2.1 Enhance Status Validation**
  ```javascript
  class StatusManager extends BaseManager {
      validateStatus(status, orderId) {
          const normalized = status.toLowerCase().trim();
          const mapped = this.STATUS_MAP[normalized];
          
          if (!mapped) {
              this.handleError(
                  new Error(`Invalid status: ${status}`),
                  { orderId, originalStatus: status }
              );
              return false;
          }
          return mapped;
      }
  }
  ```
- [ ] **2.2 Add Atomic Counter Updates**
  ```javascript
  async updateOrderCounts(newCounts) {
      return this.executeWithLock(async () => {
          const current = await this.#getCurrentCounts();
          const validated = await this.#validateCounters(newCounts);
          const updated = await this.#atomicUpdate(validated);
          await this.#notifyUI(updated);
          return updated;
      });
  }
  ```
- [ ] **2.3 Implement Recovery Mechanism**
  ```javascript
  async #atomicUpdate(counts) {
      const snapshot = await this.#createSnapshot();
      try {
          const result = await this.#performUpdate(counts);
          await this.#verifyUpdate(result);
          return result;
      } catch (error) {
          await this.#rollback(snapshot);
          throw error;
      }
  }
  ```

### Phase 3: Cache Enhancement (Week 2)
- [ ] **3.1 Add Version Control**
  ```