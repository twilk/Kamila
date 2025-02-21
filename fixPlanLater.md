# Plan optymalizacji (Phase 2)

## 1. Zaawansowana obsługa błędów

### 1.1 Retry Mechanism
```javascript
class ManagerRegistry {
  #retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000
  };

  async get(name, retryCount = 0) {
    try {
      // ... existing get logic ...
    } catch (error) {
      if (retryCount < this.#retryConfig.maxRetries) {
        const delay = Math.min(
          this.#retryConfig.baseDelay * Math.pow(2, retryCount),
          this.#retryConfig.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.get(name, retryCount + 1);
      }
      throw error;
    }
  }
}
```

### 1.2 Recovery Mechanism
```javascript
class ManagerRegistry {
  async initializeWithRecovery() {
    try {
      await this.initializeAll();
    } catch (error) {
      const failedManagers = Array.from(this.#managers.entries())
        .filter(([_, manager]) => !manager.isInitialized());

      for (const [name, manager] of failedManagers) {
        try {
          await manager.initialize();
        } catch (e) {
          console.error(`Failed to recover ${name}:`, e);
        }
      }
    }
  }
}
```

## 2. Dependency Management

### 2.1 Dependency Graph
```javascript
class DependencyGraph {
  #nodes = new Map();
  #edges = new Map();

  addNode(managerId) {
    if (!this.#nodes.has(managerId)) {
      this.#nodes.set(managerId, {
        inDegree: 0,
        outDegree: 0
      });
      this.#edges.set(managerId, new Set());
    }
  }

  addDependency(manager, dependency) {
    this.addNode(manager);
    this.addNode(dependency);
    
    this.#edges.get(manager).add(dependency);
    this.#nodes.get(manager).outDegree++;
    this.#nodes.get(dependency).inDegree++;
  }

  getInitializationOrder() {
    const order = [];
    const queue = [];
    const inDegree = new Map(
      Array.from(this.#nodes.entries())
        .map(([node, data]) => [node, data.inDegree])
    );

    // Add nodes with no dependencies to queue
    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }

    while (queue.length > 0) {
      const node = queue.shift();
      order.push(node);

      for (const neighbor of this.#edges.get(node)) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (order.length !== this.#nodes.size) {
      throw new Error('Circular dependency detected');
    }

    return order;
  }
}
```

### 2.2 Lazy Loading Groups
```javascript
class ManagerRegistry {
  #groups = new Map();
  #groupInitStatus = new Map();

  registerGroup(groupName, managerNames, dependencies = []) {
    this.#groups.set(groupName, {
      managers: managerNames,
      dependencies,
      initialized: false
    });
  }

  async initializeGroup(groupName) {
    if (this.#groupInitStatus.get(groupName)) return;
    
    const group = this.#groups.get(groupName);
    if (!group) throw new Error(`Group ${groupName} not found`);
    
    // Initialize dependencies first
    for (const dep of group.dependencies) {
      await this.initializeGroup(dep);
    }
    
    // Initialize all managers in group
    const instances = await Promise.all(
      group.managers.map(name => this.get(name))
    );
    
    // Wait for all to be ready
    await Promise.all(
      instances.map(instance => instance.waitForReady())
    );
    
    this.#groupInitStatus.set(groupName, true);
  }
}
```

## 3. Performance Monitoring

### 3.1 Metrics Collection
```javascript
class ManagerMetrics {
  #initTimes = new Map();
  #errors = new Map();
  #stateChanges = new Map();
  #memoryUsage = new Map();

  recordInitTime(managerId, time) {
    this.#initTimes.set(managerId, time);
  }

  recordError(managerId, error) {
    if (!this.#errors.has(managerId)) {
      this.#errors.set(managerId, []);
    }
    this.#errors.get(managerId).push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack
    });
  }

  recordStateChange(managerId, fromState, toState) {
    if (!this.#stateChanges.has(managerId)) {
      this.#stateChanges.set(managerId, []);
    }
    this.#stateChanges.get(managerId).push({
      timestamp: Date.now(),
      from: fromState,
      to: toState
    });
  }

  recordMemoryUsage(managerId) {
    if (typeof performance.memory !== 'undefined') {
      this.#memoryUsage.set(managerId, {
        timestamp: Date.now(),
        ...performance.memory
      });
    }
  }

  getMetrics() {
    return {
      initialization: {
        times: Object.fromEntries(this.#initTimes),
        averageTime: Array.from(this.#initTimes.values())
          .reduce((sum, time) => sum + time, 0) / this.#initTimes.size
      },
      errors: Object.fromEntries(this.#errors),
      stateChanges: Object.fromEntries(this.#stateChanges),
      memory: Object.fromEntries(this.#memoryUsage)
    };
  }
}
```

### 3.2 Health Checks
```javascript
class ManagerHealthCheck {
  #registry;
  #healthStates = new Map();
  #checkInterval = 30000; // 30 seconds
  #thresholds = {
    initTime: 5000,
    errorCount: 3,
    memoryUsage: 50 * 1024 * 1024, // 50MB
    stateChangeRate: 10 // per minute
  };

  constructor(registry) {
    this.#registry = registry;
    this.startHealthChecks();
  }

  async checkHealth(managerId) {
    const manager = await this.#registry.get(managerId);
    if (!manager) return false;

    const metrics = manager.getMetrics?.() || {};
    const health = {
      initialized: manager.isInitialized(),
      ready: manager.isReady(),
      errorCount: (metrics.errors || []).length,
      lastError: metrics.errors?.[metrics.errors.length - 1],
      memoryUsage: metrics.memory?.usedJSHeapSize,
      stateChangeRate: this.calculateStateChangeRate(metrics.stateChanges)
    };

    const isHealthy = 
      health.initialized &&
      health.ready &&
      health.errorCount < this.#thresholds.errorCount &&
      (!health.memoryUsage || health.memoryUsage < this.#thresholds.memoryUsage) &&
      health.stateChangeRate < this.#thresholds.stateChangeRate;

    this.#healthStates.set(managerId, {
      ...health,
      healthy: isHealthy,
      timestamp: Date.now()
    });

    return isHealthy;
  }

  private startHealthChecks() {
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        if (!health.healthy) {
          await this.#registry.initializeWithRecovery();
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.#checkInterval);
  }

  private calculateStateChangeRate(stateChanges = []) {
    const oneMinuteAgo = Date.now() - 60000;
    return stateChanges.filter(change => change.timestamp > oneMinuteAgo).length;
  }
}
```

## 4. Security Enhancements

### 4.1 Chrome API Sandbox
```javascript
class ChromeAPISandbox {
  #allowedAPIs = new Set(['storage', 'runtime', 'tabs']);
  #rateLimits = new Map();
  #accessLog = [];

  constructor() {
    this.setupRateLimits();
  }

  setupRateLimits() {
    this.#rateLimits.set('storage', { max: 100, interval: 60000 }); // 100 calls per minute
    this.#rateLimits.set('runtime', { max: 1000, interval: 60000 }); // 1000 calls per minute
    this.#rateLimits.set('tabs', { max: 50, interval: 60000 }); // 50 calls per minute
  }

  async callChromeAPI(api, method, params) {
    if (!this.#allowedAPIs.has(api)) {
      throw new Error(`Access to chrome.${api} is not allowed`);
    }

    if (!this.checkRateLimit(api)) {
      throw new Error(`Rate limit exceeded for chrome.${api}`);
    }

    this.logAccess(api, method, params);

    try {
      return await chrome[api][method](...params);
    } catch (error) {
      this.logError(api, method, error);
      throw error;
    }
  }

  private checkRateLimit(api) {
    const limit = this.#rateLimits.get(api);
    if (!limit) return true;

    const now = Date.now();
    const calls = this.#accessLog
      .filter(log => log.api === api && now - log.timestamp < limit.interval)
      .length;

    return calls < limit.max;
  }

  private logAccess(api, method, params) {
    this.#accessLog.push({
      timestamp: Date.now(),
      api,
      method,
      params: JSON.stringify(params)
    });
  }

  private logError(api, method, error) {
    console.error(`Chrome API Error: ${api}.${method}`, error);
  }
}
```

### 4.2 Input Validation
```javascript
class InputValidator {
  static validateManagerName(name) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('Invalid manager name');
    }
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
      throw new Error('Manager name must start with a letter and contain only alphanumeric characters');
    }
    return name;
  }

  static validateManagerClass(ManagerClass) {
    if (typeof ManagerClass !== 'function') {
      throw new Error('Manager class must be a constructor');
    }
    if (!(ManagerClass.prototype instanceof BaseManager)) {
      throw new Error('Manager class must extend BaseManager');
    }
    return ManagerClass;
  }

  static validateState(state) {
    if (state === null || typeof state !== 'object') {
      throw new Error('State must be an object');
    }
    return state;
  }

  static sanitizeString(value, maxLength = 1000) {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }
    return value.slice(0, maxLength);
  }
}
```

## 5. Extended Testing

### 5.1 Performance Tests
```javascript
describe('ManagerRegistry Performance', () => {
  let registry;
  let metrics;

  beforeEach(() => {
    registry = new ManagerRegistry();
    metrics = new ManagerMetrics();
  });

  it('should initialize managers within time limit', async () => {
    const startTime = performance.now();
    await registry.initializeAll();
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });

  it('should not exceed memory limit', async () => {
    const memoryBefore = performance.memory?.usedJSHeapSize;
    await registry.initializeAll();
    const memoryAfter = performance.memory?.usedJSHeapSize;
    
    const memoryIncrease = memoryAfter - memoryBefore;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max
  });

  it('should handle concurrent operations', async () => {
    const operations = Array(100).fill(0).map((_, i) => 
      registry.get(`manager${i % 10}`)
    );
    
    const startTime = performance.now();
    await Promise.all(operations);
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(1000); // 1 second max
  });
});
```

### 5.2 Stress Tests
```javascript
describe('ManagerRegistry Stress Tests', () => {
  let registry;

  beforeEach(() => {
    registry = new ManagerRegistry();
  });

  it('should handle rapid reinitialization', async () => {
    for (let i = 0; i < 10; i++) {
      await registry.initializeAll();
      // Force cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const managers = Array.from(registry.#managers.values());
    expect(managers.every(m => m.isInitialized())).toBe(true);
  });

  it('should recover from errors', async () => {
    // Simulate random failures
    const originalGet = registry.get.bind(registry);
    registry.get = jest.fn().mockImplementation(async (name) => {
      if (Math.random() < 0.3) {
        throw new Error('Random failure');
      }
      return originalGet(name);
    });

    try {
      await registry.initializeWithRecovery();
    } catch (error) {
      // Should not reach here
      fail('Recovery failed');
    }
  });

  it('should handle resource exhaustion', async () => {
    // Create many managers
    for (let i = 0; i < 1000; i++) {
      registry.register(`manager${i}`, class extends BaseManager {});
    }

    await registry.initializeAll();
    
    const metrics = await registry.getMetrics();
    expect(metrics.initialization.averageTime).toBeLessThan(10); // 10ms per manager
  });
});
```

## 6. Definition of Done dla Phase 2

- [ ] Retry mechanism działa
- [ ] Recovery mechanism działa
- [ ] Dependency graph zaimplementowany
- [ ] Lazy loading groups działają
- [ ] Metryki zbierane
- [ ] Health checks aktywne
- [ ] Security measures zaimplementowane
- [ ] Extended tests przechodzą
- [ ] Performance benchmarks spełnione
- [ ] Memory usage w normie
- [ ] Rate limiting działa
- [ ] Input validation aktywna
- [ ] Context synchronization działa
- [ ] Operation queuing działa
- [ ] Chrome event handling działa
- [ ] Resource cleanup działa 