# CounterManager API Documentation

## Overview

CounterManager is a service responsible for managing and animating counters in the UI. It provides functionality for registering counters, updating their values with animations, and caching counter states.

## Installation

```javascript
import { CounterManager } from '../../services/core/CounterManager.js';

// Get instance
const counterManager = CounterManager.getInstance();
```

## Dependencies

CounterManager requires the following dependencies:
- `EventManager` - for emitting counter events
- `StoreManager` - for caching counter values

## Configuration

```javascript
const COUNTER_CONFIG = {
    ANIMATION_DURATION: 300, // ms
    UPDATE_DEBOUNCE: 100, // ms
    CACHE_TTL: 5 * 60 * 1000 // 5 minutes
};
```

## Methods

### registerCounter

Register a new counter element.

```javascript
await counterManager.registerCounter(element: HTMLElement, initialValue: number = 0): Promise<void>
```

Parameters:
- `element` - HTML element to use as counter
- `initialValue` - Initial counter value (default: 0)

Example:
```javascript
const element = document.getElementById('my-counter');
await counterManager.registerCounter(element, 10);
```

### unregisterCounter

Unregister a counter.

```javascript
await counterManager.unregisterCounter(id: string): Promise<void>
```

Parameters:
- `id` - Counter ID (element ID)

Example:
```javascript
await counterManager.unregisterCounter('my-counter');
```

### updateCounter

Update counter value with optional animation.

```javascript
await counterManager.updateCounter(id: string, value: number, animate: boolean = true): Promise<void>
```

Parameters:
- `id` - Counter ID (element ID)
- `value` - New counter value
- `animate` - Whether to animate the change (default: true)

Example:
```javascript
await counterManager.updateCounter('my-counter', 42);
```

### getCounterValue

Get current counter value.

```javascript
await counterManager.getCounterValue(id: string): Promise<number>
```

Parameters:
- `id` - Counter ID (element ID)

Returns:
- Current counter value

Example:
```javascript
const value = await counterManager.getCounterValue('my-counter');
```

## Events

### counter:registered

Emitted when a counter is registered.

```javascript
{
    id: string;        // Counter ID
    value: number;     // Initial value
    timestamp: number; // Registration time
}
```

### counter:unregistered

Emitted when a counter is unregistered.

```javascript
{
    id: string;        // Counter ID
    timestamp: number; // Unregistration time
}
```

### counter:updated

Emitted when a counter value is updated.

```javascript
{
    id: string;           // Counter ID
    value: number;        // New value
    previousValue: number; // Previous value
    timestamp: number;    // Update time
}
```

## CSS Classes

### Animation Classes

```css
.count-increased {
    animation: countIncrease 0.3s ease-out;
}

.count-decreased {
    animation: countDecrease 0.3s ease-out;
}

.count-zero {
    opacity: 0.5;
}
```

### Animations

```css
@keyframes countIncrease {
    0% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
}

@keyframes countDecrease {
    0% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
}
```

## Examples

### Basic Counter

```javascript
// HTML
<div id="my-counter" class="order-counter">0</div>

// JavaScript
const counterManager = CounterManager.getInstance();
const element = document.getElementById('my-counter');

// Register counter
await counterManager.registerCounter(element, 0);

// Update value with animation
await counterManager.updateCounter('my-counter', 42);
```

### Multiple Counters

```javascript
// HTML
<div class="counter-group">
    <div id="counter-1" class="order-counter">0</div>
    <div id="counter-2" class="order-counter">0</div>
    <div id="total" class="order-counter">0</div>
</div>

// JavaScript
const counterManager = CounterManager.getInstance();

// Register counters
await Promise.all([
    counterManager.registerCounter(document.getElementById('counter-1'), 0),
    counterManager.registerCounter(document.getElementById('counter-2'), 0),
    counterManager.registerCounter(document.getElementById('total'), 0)
]);

// Update values
await Promise.all([
    counterManager.updateCounter('counter-1', 10),
    counterManager.updateCounter('counter-2', 20)
]);

// Update total
const total = await Promise.all([
    counterManager.getCounterValue('counter-1'),
    counterManager.getCounterValue('counter-2')
]).then(values => values.reduce((sum, v) => sum + v, 0));

await counterManager.updateCounter('total', total);
```

### Event Handling

```javascript
const eventManager = await counterManager.getDependency('event');

// Listen for counter updates
eventManager.on('counter:updated', async ({ id, value, previousValue }) => {
    console.log(`Counter ${id} changed from ${previousValue} to ${value}`);
});

// Listen for counter registration
eventManager.on('counter:registered', async ({ id, value }) => {
    console.log(`Counter ${id} registered with value ${value}`);
});
```

### Error Handling

```javascript
try {
    await counterManager.updateCounter('non-existent', 42);
} catch (error) {
    console.error('Failed to update counter:', error);
}
```

## Best Practices

1. Always register counters before updating them
2. Use debouncing for rapid updates
3. Cache counter values for better performance
4. Clean up by unregistering counters when no longer needed
5. Handle errors gracefully
6. Use animations sparingly for better performance

## Troubleshooting

Common issues and solutions:

1. Counter not updating
   - Check if counter is registered
   - Verify element ID is correct
   - Check for JavaScript errors

2. Animations not working
   - Verify CSS classes are properly loaded
   - Check if animations are enabled
   - Verify browser support for animations

3. Cache not working
   - Check StoreManager dependency
   - Verify cache TTL configuration
   - Check for storage quota issues

## Metrics

CounterManager provides metrics for monitoring:

```javascript
const metrics = counterManager.getMetrics();
```

Returns:
```javascript
{
    counters: {
        total: number;     // Total registered counters
        pending: number;   // Pending updates
        lastUpdate: number; // Last update timestamp
    }
}
``` 