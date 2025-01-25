# NADRZĘDNA INSTRUKCJA DLA AI

> **WAŻNE**: Wszystkie komponenty i funkcjonalności są już zaimplementowane w kodzie bazowym. 
> Twoim zadaniem jest WYŁĄCZNIE:
> 1. Odnalezienie istniejących implementacji w kodzie
> 2. Prawidłowe połączenie ich ze sobą
> 3. Wykorzystanie gotowych funkcji i komponentów
> 4. NIE twórz nowych implementacji, jeśli podobna funkcjonalność już istnieje
> 5. Aktualizuj ten TODO po każdym wykonanym zadaniu


# Order Status System Analysis

## Core Components Analysis

1. Data Loading System (`notifyPopupOpened`, `loadAndUpdateData`)
   - Initial Loading:
     ```javascript
     // Show loading state in counters
     document.querySelectorAll('.lead-count').forEach(counter => {
         showLoader(counter);
         counter.classList.remove('count-error', 'count-zero');
     });
     ```
   - Cache Check:
     ```javascript
     const { leadCounts } = await chrome.storage.local.get('leadCounts');
     if (leadCounts) {
         updateCounters(leadCounts);
     }
     ```
   - Background Update:
     ```javascript
     const response = await chrome.runtime.sendMessage({ type: 'POPUP_OPENED' });
     if (response.counts) {
         updateCounters(response.counts);
         await chrome.storage.local.set({ leadCounts: response.counts });
     }
     ```

2. Status Mapping System
   ```javascript
   const STATUS_MAP = {
       'submitted': '1',
       'confirmed': '2',
       'accepted': '3',
       'ready': 'READY',
       'overdue': 'OVERDUE'
   };
   ```

3. Progress Management (`ProgressManager`)
   - Types of Updates:
     - START_TASK: Show progress bar
     - UPDATE_TASK: Update progress
     - UPDATE_STATUS: Set status text
     - ERROR/SUCCESS/WARNING: Show appropriate messages
     - COMPLETE: Mark task as done

4. Event Handling System
   ```javascript
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
       if (message.type === 'PROGRESS_UPDATE' && message.data) {
           handleProgressUpdate(message.data);
       }
       if (message.type === 'LOG') {
           appendLog(text, level, data);
       }
   });
   ```

## Detailed Implementation Notes

1. Counter Update Flow:
   ```javascript
   async function updateCounters(counts) {
       // Reset all counters first
       document.querySelectorAll('.lead-count').forEach(counter => {
           counter.textContent = '0';
           counter.classList.add('count-zero');
       });

       // Update each status count
       Object.entries(counts).forEach(([status, count]) => {
           const element = document.querySelector(`[data-status="${status}"]`);
           if (element) {
               element.textContent = count;
               element.classList.toggle('count-zero', count === 0);
               element.classList.add('count-changed');
               setTimeout(() => element.classList.remove('count-changed'), 500);
           }
       });

       // Update total
       updateTotalCount(counts);
   }
   ```

2. Store Integration:
   ```javascript
   async function initializeStoreSelect() {
       const select = document.getElementById('store-select');
       const { selectedStore } = await chrome.storage.local.get('selectedStore');
       
       // Populate stores
       stores.forEach(store => {
           const option = document.createElement('option');
           option.value = store.id;
           option.textContent = store.name;
           select.appendChild(option);
       });

       // Set selected store
       if (selectedStore) {
           select.value = selectedStore;
       }

       // Handle store changes
       select.addEventListener('change', async () => {
           await chrome.storage.local.set({ selectedStore: select.value });
           await loadAndUpdateData(true);
       });
   }
   ```

3. Error Recovery System:
   ```javascript
   function handleError(error) {
       logToPanel('❌ ' + error.message, 'error');
       document.querySelectorAll('.lead-count').forEach(counter => {
           counter.textContent = '-';
           counter.classList.add('count-error');
       });
       progressManager.setError(error.message);
   }
   ```

4. Notification System:
   ```javascript
   async function updateLeadCounts(newCounts, oldCounts = {}) {
       // Check for significant changes
       if (newCounts['1'] > oldCounts['1']) {
           chrome.notifications.create({
               type: 'basic',
               iconUrl: 'icon128.png',
               title: 'Nowe zamówienia',
               message: `Liczba nowych zamówień: ${newCounts['1']}`
           });
       }
   }
   ```

## Critical Integration Points

1. Data Flow Chain:
   ```
   popup.js (loadAndUpdateData)
   ↓
   background.js (fetchDarwinaData)
   ↓
   API Service (makeRequest)
   ↓
   Storage Service (saveToStorage)
   ↓
   UI Update (updateCounters)
   ```

2. Event Chain:
   ```
   Store Change → Clear Cache → Fetch New Data → Update UI
   API Error → Use Cache → Show Warning → Retry Later
   Force Refresh → Clear Cache → Show Progress → Update UI
   ```

3. Status Update Chain:
   ```
   New Data → Calculate Counts → Compare with Old → Show Notifications → Update UI
   ```

## Current Implementation Status

1. Core Systems:
   - ✅ Data Loading (100%)
   - ✅ Cache Management (100%)
   - ✅ Error Handling (100%)
   - ✅ Progress Display (100%)

2. UI Components:
   - ✅ Counter Display (100%)
   - ✅ Store Selector (100%)
   - ✅ Status Indicators (100%)
   - ✅ Loading States (100%)

3. Integration Points:
   - ✅ API Communication (100%)
   - ✅ Event Handling (100%)
   - ✅ Storage Management (100%)
   - ✅ Notification System (100%)

## Verification Steps

1. Initial Load:
   - Check loading indicators
   - Verify cache usage
   - Confirm UI updates

2. Store Changes:
   - Verify cache clearing
   - Check new data fetch
   - Confirm UI refresh

3. Error Scenarios:
   - Test API failures
   - Verify cache fallback
   - Check error displays

4. Refresh Actions:
   - Test manual refresh
   - Verify auto-refresh
   - Check progress display