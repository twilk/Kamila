# InitializationManager Review and Proposal

## Current InitializationManager Capabilities

```javascript
class InitializationManager extends BaseManager {
    #initializationOrder = null;
    #initializationStatus = new Map();
    #isInitializing = false;
    #initializationPromise = null;
    #initializationResolve = null;
    #maxRetries = 3;
    #retryDelay = 1000;
}
```

## Key Features We Should Use

1. **Initialization Status Tracking**
```javascript
// Already implements
#initializationStatus = new Map<string, {
    status: 'initializing' | 'initialized' | 'failed',
    startTime: number,
    duration?: number,
    error?: string
}>();
```

2. **Dependency Resolution**
```javascript
async #checkDependencies(manager) {
    const dependencies = Array.from(manager._dependencies);
    for (const dependency of dependencies) {
        if (!dependency.isInitialized()) {
            throw new Error(`Dependency ${dependency.name} not initialized`);
        }
        await dependency.waitForReady();
    }
}
```

3. **Retry Mechanism**
```javascript
// Already has retry logic with:
#maxRetries = 3;
#retryDelay = 1000;
```

## How To Use It Properly

### 1. Entry Point Control
```javascript
// In background.js
chrome.runtime.onInstalled.addListener(async () => {
    const initManager = await managers.initializationManager();
    await initManager.initializeAll();
});

// In popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const initManager = await managers.initializationManager();
    await initManager.waitForInitialization();
});
```

### 2. Alarm Handler Safety
```javascript
// In background.js
chrome.alarms.onAlarm.addListener(async (alarm) => {
    const initManager = await managers.initializationManager();
    if (!await initManager.isSystemReady()) {
        // Queue the alarm for later
        await initManager.queueEvent('alarm', alarm);
        return;
    }
    // Handle alarm normally
});
```

### 3. Manager Registration
```javascript
// In managers.js
export async function registerManagers() {
    const initManager = await managers.initializationManager();
    
    // Register core dependencies
    await initManager.registerDependencies('ErrorHandler', []);
    await initManager.registerDependencies('LogManager', ['ErrorHandler']);
    await initManager.registerDependencies('EventManager', ['ErrorHandler', 'LogManager']);
    // ...
}
```

### 4. State Management
```javascript
// In BaseManager
class BaseManager {
    async initialize() {
        const initManager = await managers.initializationManager();
        await initManager.beginInitialization(this.name);
        try {
            await this.onInitialize();
            await initManager.completeInitialization(this.name);
        } catch (error) {
            await initManager.failInitialization(this.name, error);
            throw error;
        }
    }
}
```

## Required Changes to InitializationManager

### 1. Add Event Queuing
```javascript
class InitializationManager {
    #eventQueue = new Map();
    
    async queueEvent(type, data) {
        if (!this.#eventQueue.has(type)) {
            this.#eventQueue.set(type, []);
        }
        this.#eventQueue.get(type).push({
            data,
            timestamp: Date.now()
        });
    }
    
    async processEventQueue() {
        for (const [type, events] of this.#eventQueue) {
            for (const event of events) {
                await this.#processEvent(type, event);
            }
        }
        this.#eventQueue.clear();
    }
}
```

### 2. Add System Ready Check
```javascript
class InitializationManager {
    async isSystemReady() {
        const statuses = Array.from(this.#initializationStatus.values());
        return statuses.every(s => s.status === 'initialized');
    }
    
    async waitForSystemReady(timeout = 30000) {
        const start = Date.now();
        while (!await this.isSystemReady()) {
            if (Date.now() - start > timeout) {
                throw new Error('System ready timeout');
            }
            await new Promise(r => setTimeout(r, 100));
        }
    }
}
```

### 3. Add State Management
```javascript
class InitializationManager {
    async beginInitialization(managerName) {
        this.#initializationStatus.set(managerName, {
            status: 'initializing',
            startTime: Date.now()
        });
    }
    
    async completeInitialization(managerName) {
        const status = this.#initializationStatus.get(managerName);
        this.#initializationStatus.set(managerName, {
            ...status,
            status: 'initialized',
            duration: Date.now() - status.startTime
        });
    }
    
    async failInitialization(managerName, error) {
        const status = this.#initializationStatus.get(managerName);
        this.#initializationStatus.set(managerName, {
            ...status,
            status: 'failed',
            error: error.message,
            duration: Date.now() - status.startTime
        });
    }
}
```

## Implementation Plan

1. **Phase 1: Core Integration**
   - Update BaseManager to use InitializationManager
   - Add event queuing
   - Add system ready checks

2. **Phase 2: Entry Points**
   - Update background.js
   - Update popup.js
   - Add alarm handling safety

3. **Phase 3: State Management**
   - Add state tracking
   - Add dependency validation
   - Add initialization order enforcement

4. **Phase 4: Recovery**
   - Add retry mechanism
   - Add timeout handling
   - Add error recovery

## Success Metrics

1. No initialization errors
2. Proper dependency resolution
3. No race conditions
4. Events properly queued and processed
5. System state properly tracked
6. Clean error handling

## Notes
- Keep existing retry mechanism
- Use existing status tracking
- Leverage current dependency validation
- Add proper logging
- Add performance monitoring 