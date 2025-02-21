# Toggle Elements Analysis

## 1. Theme Switch

### Location and Code
Located in `popup.html` (lines 186-215):
```html
<label class="theme-toggle" title="Toggle theme">
    <span class="theme-toggle__sun">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <!-- Sun icon SVG path -->
        </svg>
    </span>
    <span class="theme-toggle__moon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
            <!-- Moon icon SVG path -->
        </svg>
    </span>
    <input type="checkbox" class="theme-toggle__input" id="theme-switch" aria-label="Toggle theme">
    <span class="theme-toggle__slider"></span>
</label>
```

### Complete Styles

1. CSS Variables (`styles/theme.css`):
```css
:root {
  /* Theme Switch Colors */
  --switch-bg: #e8e8e8;
  --switch-border: #d1d1d1;
  --switch-active: var(--wine-primary);
  --switch-handle: #ffffff;
  --switch-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

[data-theme='dark'] {
  --switch-bg: #183153;
  --switch-border: #374151;
  --switch-active: var(--wine-accent);
  --switch-handle: #ffffff;
  --switch-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
```

2. Base Switch Styles (`styles/theme.css`):
```css
.theme-toggle {
  font-size: 17px;
  position: relative;
  display: inline-block;
  width: 64px;
  height: 34px;
}

.theme-toggle__input {
  opacity: 0;
  width: 0;
  height: 0;
}

.theme-toggle__slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #73C0FC;
  transition: .4s;
  border-radius: 30px;
}

.theme-toggle__slider:before {
  position: absolute;
  content: "";
  height: 30px;
  width: 30px;
  border-radius: 20px;
  left: 2px;
  bottom: 2px;
  z-index: 2;
  background-color: #e8e8e8;
  transition: .4s;
}
```

3. Icon Styles (`styles/theme.css`):
```css
.theme-toggle__sun svg {
  position: absolute;
  top: 6px;
  left: 36px;
  z-index: 1;
  width: 24px;
  height: 24px;
}

.theme-toggle__moon svg {
  fill: #73C0FC;
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: 1;
  width: 24px;
  height: 24px;
}

.theme-toggle__sun, .theme-toggle__moon {
  position: absolute;
  width: 20px;
  height: 20px;
  top: 7px;
  z-index: 1;
  transition: .4s;
}

.theme-toggle__sun {
  left: 7px;
  opacity: 1;
}

.theme-toggle__moon {
  right: 7px;
  opacity: 0;
}

.theme-toggle__input:checked ~ .theme-toggle__sun {
  opacity: 0;
}

.theme-toggle__input:checked ~ .theme-toggle__moon {
  opacity: 1;
}
```

4. State Styles (`styles/theme.css`):
```css
.theme-toggle__input:checked + .theme-toggle__slider {
  background-color: #183153;
}

.theme-toggle__input:focus + .theme-toggle__slider {
  box-shadow: 0 0 1px #183153;
}

.theme-toggle__input:checked + .theme-toggle__slider:before {
  transform: translateX(30px);
}
```

5. Animations (`styles/theme.css`):
```css
.theme-toggle__sun svg {
  animation: rotate 15s linear infinite;
}

.theme-toggle__moon svg {
  animation: tilt 5s linear infinite;
}

@keyframes rotate {
  0% { transform: rotate(0); }
  100% { transform: rotate(360deg); }
}

@keyframes tilt {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
  100% { transform: rotate(0deg); }
}

.theme-toggle__sun svg, .theme-toggle__moon svg {
  width: 100%;
  height: 100%;
  transition: transform .4s ease;
}

.theme-toggle:hover .theme-toggle__sun svg {
  transform: rotate(45deg);
}

.theme-toggle:hover .theme-toggle__moon svg {
  transform: scale(1.1);
}
```

### Event Triggers
1. In `UIManager.js` (lines 684-724):
```javascript
async handleThemeToggle(event) {
    try {
        const button = event.target;
        const themeManager = ThemeManager.getInstance();
        const { theme: currentTheme } = themeManager.getThemeSettings();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        await themeManager.setTheme(newTheme, false);
        button.setAttribute('aria-pressed', String(newTheme === 'dark'));
        button.classList.toggle('theme-dark', newTheme === 'dark');
        const themeSwitch = document.getElementById('theme-switch');
        if (themeSwitch) {
            themeSwitch.checked = newTheme === 'dark';
        }
        this.log(LogLevel.DEBUG, '🎨 Theme toggled', { theme: newTheme });
    } catch (error) {
        this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
            method: 'handleThemeToggle'
        });
    }
}
```

2. In `ThemeManager.js` (lines 276-290):
```javascript
async toggleTheme() {
    try {
        const newTheme = this.#currentTheme === 'light' ? 'dark' : 'light';
        await this.setTheme(newTheme, false);
    } catch (error) {
        this.handleError(error, ErrorType.OPERATION, ErrorSeverity.LOW, {
            method: 'toggleTheme'
        });
    }
}
```

## 2. Debug Switch

### Location and Code
Located in `popup.html` (lines 141-168):
```html
<div class="settings-section">
    <h6 data-i18n="debugTitle">Debug</h6>
    <div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" id="debug-switch" checked>
        <label class="form-check-label" for="debug-switch" data-i18n="debugMode">Tryb debugowania</label>
    </div>
</div>
```

### Complete Styles

1. CSS Variables (`styles/test.css`):
```css
:root {
    --debug-panel-offset: 0px;
}
```

2. Base Switch Styles (`style.css`):
```css
.form-switch {
    padding-left: 2.5rem;
}

.form-check-input {
    margin: 0;
    cursor: pointer;
    border: none;
    background-color: var(--border-light);
}

.settings-compact .form-switch .form-check-input {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='rgba(0, 0, 0, 0.25)'/%3e%3c/svg%3e");
}

.settings-compact .form-switch .form-check-input:checked {
    background-color: var(--primary);
    border-color: var(--primary);
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23fff'/%3e%3c/svg%3e");
}
```

3. Debug Panel Styles (`style.css`):
```css
.debug-panel {
    position: fixed;
    bottom: -100px;
    left: 0;
    right: 0;
    height: 200px;
    background: rgba(248, 249, 250, 0.95);
    border-top: 1px solid var(--light-border);
    padding: 16px;
    z-index: 1000;
    transition: bottom 0.3s ease-in-out;
    display: none;
}

body.debug-enabled .debug-panel {
    display: block;
    bottom: -100px;
}

body.debug-enabled .debug-panel:hover {
    bottom: 0;
}

.debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
}

.debug-content {
    height: 150px;
    overflow-y: auto;
    padding: 0.5rem;
}
```

4. Dark Theme Support (`style.css`):
```css
[data-theme="dark"] .form-check-input {
    background-color: var(--border-dark);
}

[data-theme="dark"] .form-check-input:checked {
    background-color: var(--primary-light);
}

[data-theme="dark"] .debug-panel {
    background: rgba(33, 37, 41, 0.95);
    border-top-color: var(--dark-border);
}

html[data-theme="dark"] .debug-panel {
    background: var(--bs-dark);
    border-color: var(--bs-gray-700);
}

html[data-theme="dark"] #debug-logs {
    background: var(--bs-gray-900);
    border-color: var(--bs-gray-700);
}
```

### Event Triggers
1. In `debugManager.js` (lines 31-52):
```javascript
initializeDebugSwitch() {
    const debugSwitch = document.getElementById('debug-switch');
    if (!debugSwitch) return;
    
    debugSwitch.checked = false;
    document.body.classList.remove('debug-enabled');
    chrome.storage.local.set({ debugMode: false });
    
    debugSwitch.addEventListener('change', async (e) => {
        if (e.target.checked) {
            if (!await this.checkDebugAccess()) {
                e.target.checked = false;
            }
        } else {
            document.body.classList.remove('debug-enabled');
            await chrome.storage.local.set({ debugMode: false });
            logToPanel(i18n.translate('debugDisabled'), 'info');
        }
    });
}
```

2. In `popup.js` (lines 1489-1511):
```javascript
function initializeDebugSwitch() {
    const debugSwitch = document.getElementById('debug-switch');
    if (!debugSwitch) return;
    
    debugSwitch.checked = false;
    document.body.classList.remove('debug-enabled');
    chrome.storage.local.set({ debugMode: false });
    
    debugSwitch.addEventListener('change', async (e) => {
        if (e.target.checked) {
            if (!await checkDebugAccess()) {
                e.target.checked = false;
            }
        } else {
            document.body.classList.remove('debug-enabled');
            await chrome.storage.local.set({ debugMode: false });
            logToPanel(i18n.translate('debugDisabled'), 'info');
        }
    });
}
```

# Theme Toggle Analysis & Solutions

## 1. Event Flow Analysis

### Current Implementation
1. Event chain:
   ```
   Click on theme-switch
   → Native checkbox change
   → UIManager.handleThemeToggle
   → ThemeManager.setTheme
   → Updates DOM theme attribute
   → CSS theme variables apply
   ```

2. Issues Found:
   - Event listener is set up incorrectly: `#themeToggle` vs `#theme-switch`
   - Multiple event paths that might conflict
   - No initialization of checkbox state on page load

### Proposed Event Flow
1. Single source of truth:
```javascript
// In UIManager.js
async initializeUI() {
    // ... other initialization code ...
    
    // Initialize theme toggle
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        const { theme } = await ThemeManager.getInstance().getThemeSettings();
        themeSwitch.checked = theme === 'dark';
        themeSwitch.addEventListener('change', this.handleThemeToggle.bind(this));
    }
}

async handleThemeToggle(event) {
    try {
        const themeSwitch = event.target;
        const newTheme = themeSwitch.checked ? 'dark' : 'light';
        await ThemeManager.getInstance().setTheme(newTheme, false);
    } catch (error) {
        // Revert checkbox state on error
        themeSwitch.checked = !themeSwitch.checked;
        this.handleError(error);
    }
}
```

## 2. Style Issues

### Current Problems
1. Generic class names causing conflicts:
   - `.input` is too generic
   - `.slider` could be used elsewhere
   - `.switch` might conflict with other toggle components

### Style Solution
1. Use BEM naming for theme toggle:
```html
<label class="theme-toggle" title="Toggle theme">
    <span class="theme-toggle__sun">...</span>
    <span class="theme-toggle__moon">...</span>
    <input type="checkbox" class="theme-toggle__input" id="theme-switch">
    <span class="theme-toggle__slider"></span>
</label>
```

2. Update CSS selectors to match:
```css
.theme-toggle { /* ... */ }
.theme-toggle__input { /* ... */ }
.theme-toggle__slider { /* ... */ }
.theme-toggle__sun { /* ... */ }
.theme-toggle__moon { /* ... */ }
```

## 3. Implementation Steps
1. Fix event listener setup in UIManager.js
2. Update HTML with BEM classes
3. Update CSS with BEM selectors
4. Add initialization in UIManager
5. Add error handling
6. Test all state changes

## 4. Testing Plan
1. Test initialization:
   - Page load with light theme
   - Page load with dark theme
   - Page load with system theme

2. Test interactions:
   - Click toggle → theme changes
   - Theme changes → toggle updates
   - Error occurs → toggle reverts

3. Test persistence:
   - Theme persists after reload
   - Toggle state matches theme after reload 

# Theme Toggle Fix Instructions

## Problem
The theme toggle button doesn't work because:
1. CSS classes are too generic and might conflict
2. Event listener is looking for wrong ID
3. Initial state isn't set on page load

## Fix Steps

### Step 1: Update HTML
In `popup.html`, find this code:
```html
<label class="switch" title="Toggle theme">
    <span class="sun">...</span>
    <span class="moon">...</span>
    <input type="checkbox" class="input" id="theme-switch">
    <span class="slider"></span>
</label>
```

Replace it with:
```html
<label class="theme-toggle" title="Toggle theme">
    <span class="theme-toggle__sun">...</span>
    <span class="theme-toggle__moon">...</span>
    <input type="checkbox" class="theme-toggle__input" id="theme-switch">
    <span class="theme-toggle__slider"></span>
</label>
```

### Step 2: Update CSS
In `styles/theme.css`, find and replace these classes:

```css
/* Find .switch { ... } and replace with: */
.theme-toggle {
    font-size: 17px;
    position: relative;
    display: inline-block;
    width: 64px;
    height: 34px;
}

/* Find .switch input { ... } and replace with: */
.theme-toggle__input {
    opacity: 0;
    width: 0;
    height: 0;
}

/* Find .slider { ... } and replace with: */
.theme-toggle__slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #73C0FC;
    transition: .4s;
    border-radius: 30px;
}

/* Find .slider:before { ... } and replace with: */
.theme-toggle__slider:before {
    position: absolute;
    content: "";
    height: 30px;
    width: 30px;
    border-radius: 20px;
    left: 2px;
    bottom: 2px;
    z-index: 2;
    background-color: #e8e8e8;
    transition: .4s;
}

/* Find .sun, .moon { ... } and replace with: */
.theme-toggle__sun, .theme-toggle__moon {
    position: absolute;
    width: 20px;
    height: 20px;
    top: 7px;
    z-index: 1;
    transition: .4s;
}

/* Update all other related classes similarly */
```

### Step 3: Fix Event Listener
In `UIManager.js`, find this line:
```javascript
this.setupButtonListener('#themeToggle', 'click', this.handleThemeToggle.bind(this));
```

Replace it with:
```javascript
const themeSwitch = document.getElementById('theme-switch');
if (themeSwitch) {
    themeSwitch.addEventListener('change', this.handleThemeToggle.bind(this));
}
```

### Step 4: Add Initialization
In `UIManager.js`, add this code to your initialization method:
```javascript
async initializeUI() {
    // ... existing code ...

    // Initialize theme toggle
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        const { theme } = await ThemeManager.getInstance().getThemeSettings();
        themeSwitch.checked = theme === 'dark';
    }

    // ... rest of existing code ...
}
```

### Step 5: Update Event Handler
In `UIManager.js`, update the handleThemeToggle method:
```javascript
async handleThemeToggle(event) {
    try {
        const themeSwitch = event.target;
        const newTheme = themeSwitch.checked ? 'dark' : 'light';
        await ThemeManager.getInstance().setTheme(newTheme, false);
    } catch (error) {
        // Revert checkbox state on error
        themeSwitch.checked = !themeSwitch.checked;
        this.handleError(error);
    }
}
```

## Testing
After making these changes:
1. Reload the page
2. The toggle should show correct state (dark/light)
3. Clicking toggle should change theme
4. Theme should persist after page reload
5. Toggle state should match current theme

## Troubleshooting
If toggle still doesn't work:
1. Check browser console for errors
2. Verify all class names were updated
3. Make sure theme-switch ID exists in HTML
4. Confirm event listener is attached (add console.log in handler)
5. Check if ThemeManager.setTheme is being called 

# Theme Toggle Animation Update

## New Animation Implementation

### Step 1: CSS Variables
```css
.theme-toggle {
    /* Dimensions */
    --container-width: 64px;
    --container-height: 34px;
    --container-radius: 34px;
    --sun-moon-diameter: 24px;
    --circle-container-diameter: 40px;

    /* Colors */
    --container-light-bg: #e8e8e8;
    --container-dark-bg: #1f1f1f;
    --sun-bg: #ffd371;
    --moon-bg: #ccc;
    --clouds-color: #fff;
    --back-clouds-color: rgba(255, 255, 255, 0.4);
    --stars-color: #fff;
    --spot-color: #d3d3d3;

    /* Shadows */
    --sun-shadow-inner: rgba(254, 255, 239, 0.61);
    --sun-shadow-outer: #a1872a;
    --moon-shadow-inner: rgba(254, 255, 239, 0.61);
    --moon-shadow-outer: #969696;
    --container-shadow: rgba(0, 0, 0, 0.25);
    --circle-glow: rgba(255, 255, 255, 0.1);

    /* Transitions */
    --transition: all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1);
    --circle-transition: transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);

    /* Calculations */
    --circle-container-offset: calc((var(--circle-container-diameter) - var(--container-height)) / 2 * -1);
}
```

### Step 2: Base Styles
```css
.theme-toggle {
    position: relative;
    display: inline-block;
    width: var(--container-width);
    height: var(--container-height);
    cursor: pointer;
}

.theme-toggle__checkbox {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
}

.theme-toggle__container {
    width: 100%;
    height: 100%;
    background-color: var(--container-light-bg);
    border-radius: var(--container-radius);
    position: relative;
    overflow: hidden;
    transition: var(--transition);
    cursor: pointer;
}
```

### Step 3: Animation Components
```css
/* Sun/Moon Container */
.theme-toggle__sun-moon-container {
    position: absolute;
    width: var(--sun-moon-diameter);
    height: var(--sun-moon-diameter);
    background: var(--sun-bg);
    border-radius: 50%;
    top: 50%;
    left: 5px;
    transform: translateY(-50%);
    transition: var(--transition);
    z-index: 2;
}

/* Moon Spots */
.theme-toggle__moon {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--moon-bg);
    transform: translateX(100%);
    opacity: 0;
    transition: var(--transition);
}

.theme-toggle__spot {
    position: absolute;
    background: var(--spot-color);
    border-radius: 50%;
    transition: var(--transition);
    opacity: 0;
}

.theme-toggle__spot:nth-child(1) { width: 8px; height: 8px; top: 25%; left: 15%; }
.theme-toggle__spot:nth-child(2) { width: 6px; height: 6px; top: 45%; left: 45%; }
.theme-toggle__spot:nth-child(3) { width: 4px; height: 4px; top: 15%; left: 35%; }

/* Clouds */
.theme-toggle__clouds {
    position: absolute;
    width: 100%;
    height: 100%;
    transition: var(--transition);
    z-index: 1;
    
    /* Cloud Pattern */
    box-shadow: 
        /* Front Clouds */
        0.937em 0.312em var(--clouds-color),
        1.437em 0.375em var(--clouds-color),
        2.187em 0em var(--clouds-color),
        2.937em 0.312em var(--clouds-color),
        3.625em -0.062em var(--clouds-color),
        4.5em -0.312em var(--clouds-color),
        4.625em -1.75em 0 0.437em var(--clouds-color),
        /* Back Clouds */
        -0.312em -0.312em var(--back-clouds-color),
        0.5em -0.125em var(--back-clouds-color),
        1.25em -0.062em var(--back-clouds-color),
        2em -0.312em var(--back-clouds-color),
        2.625em 0em var(--back-clouds-color),
        3.375em -0.437em var(--back-clouds-color),
        4em -0.625em var(--back-clouds-color),
        4.125em -2.125em 0 0.437em var(--back-clouds-color);
}

/* Cloud Animation */
@keyframes float {
    0% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
    100% { transform: translateY(0); }
}

.theme-toggle__clouds {
    animation: float 3s ease-in-out infinite;
}

/* Stars Animation */
@keyframes twinkle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.theme-toggle__stars-container {
    opacity: 0;
    transition: var(--transition);
}

.theme-toggle__checkbox:checked + .theme-toggle__container .theme-toggle__stars-container {
    opacity: 1;
    animation: twinkle 2s ease-in-out infinite;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
    .theme-toggle__clouds,
    .theme-toggle__stars-container {
        animation: none;
    }
}
```

### Step 4: State Changes
```
```

## Cloud Animation Implementation

### Cloud Pattern
```css
.theme-toggle__clouds {
    box-shadow: 
        /* Front Clouds */
        0.937em 0.312em var(--clouds-color),
        1.437em 0.375em var(--clouds-color),
        2.187em 0em var(--clouds-color),
        2.937em 0.312em var(--clouds-color),
        3.625em -0.062em var(--clouds-color),
        4.5em -0.312em var(--clouds-color),
        4.625em -1.75em 0 0.437em var(--clouds-color),
        /* Back Clouds */
        -0.312em -0.312em var(--back-clouds-color),
        0.5em -0.125em var(--back-clouds-color),
        1.25em -0.062em var(--back-clouds-color),
        2em -0.312em var(--back-clouds-color),
        2.625em 0em var(--back-clouds-color),
        3.375em -0.437em var(--back-clouds-color),
        4em -0.625em var(--back-clouds-color),
        4.125em -2.125em 0 0.437em var(--back-clouds-color);
}
```

### Cloud Animation
```css
@keyframes float {
    0% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
    100% { transform: translateY(0); }
}

.theme-toggle__clouds {
    animation: float 3s ease-in-out infinite;
}
```

### Stars Animation
```css
@keyframes twinkle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.theme-toggle__stars-container {
    opacity: 0;
    transition: var(--transition);
}

.theme-toggle__checkbox:checked + .theme-toggle__container .theme-toggle__stars-container {
    opacity: 1;
    animation: twinkle 2s ease-in-out infinite;
}
```

### Accessibility
```css
@media (prefers-reduced-motion: reduce) {
    .theme-toggle__clouds,
    .theme-toggle__stars-container {
        animation: none;
    }
}
```

### Testing Points
1. Cloud Movement:
   - Clouds should float up and down smoothly
   - Back clouds should move slightly slower
   - Cloud shadows should maintain proper layering

2. Star Visibility:
   - Stars should be hidden in light mode
   - Stars should fade in when switching to dark mode
   - Stars should twinkle continuously in dark mode

3. Performance:
   - Animations should run at 60fps
   - No layout shifts during animation
   - Smooth transitions between states

4. Accessibility:
   - Animations should respect reduced motion preferences
   - Animations should not interfere with contrast ratios
   - Visual state should be clear without animations

### Implementation Details

#### Dimensions and Positioning
```css
.theme-toggle {
    width: 64px;
    height: 34px;
    position: relative;
    display: inline-block;
}

.theme-toggle__slider {
    border-radius: 34px;
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.theme-toggle__slider:before {
    position: absolute;
    content: "";
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    border-radius: 50%;
    transition: 0.4s;
}
```

#### Colors and Shadows
```css
:root {
    --toggle-light-bg: #ffffff;
    --toggle-dark-bg: #363636;
    --toggle-shadow: 0 2px 5px rgba(0,0,0,0.2);
    --toggle-highlight: 0 0 2px rgba(255,255,255,0.2);
}

.theme-toggle__slider {
    background-color: var(--toggle-light-bg);
    box-shadow: var(--toggle-shadow);
}

[data-theme='dark'] .theme-toggle__slider {
    background-color: var(--toggle-dark-bg);
}
```

#### Animation Timing
```css
.theme-toggle__slider,
.theme-toggle__slider:before,
.theme-toggle__sun,
.theme-toggle__moon,
.theme-toggle__clouds {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}

@keyframes twinkle {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 1; }
}
```

### Interactions

#### Hover States
```css
.theme-toggle:hover .theme-toggle__slider {
    box-shadow: var(--toggle-highlight);
}

.theme-toggle:hover .theme-toggle__sun svg {
    transform: scale(1.1) rotate(15deg);
}

.theme-toggle:hover .theme-toggle__moon svg {
    transform: scale(1.1) rotate(-15deg);
}
```

#### Focus States
```css
.theme-toggle__input:focus + .theme-toggle__slider {
    outline: 2px solid var(--focus-color);
    outline-offset: 2px;
}

.theme-toggle__input:focus:not(:focus-visible) + .theme-toggle__slider {
    outline: none;
}
```

#### Keyboard Navigation
```javascript
// In UIManager.js
handleThemeToggleKeyboard(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.handleThemeToggle();
    }
}
```

### Responsiveness

#### Screen Size Adaptation
```css
@media (max-width: 768px) {
    .theme-toggle {
        width: 56px;
        height: 30px;
    }
    
    .theme-toggle__slider:before {
        height: 22px;
        width: 22px;
    }
}

@media (max-width: 480px) {
    .theme-toggle {
        width: 48px;
        height: 26px;
    }
    
    .theme-toggle__slider:before {
        height: 18px;
        width: 18px;
    }
}
```

#### High DPI Screens
```css
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    .theme-toggle__slider {
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .theme-toggle__sun svg,
    .theme-toggle__moon svg {
        transform-origin: center;
        transform: scale(0.5);
    }
}
```

### System Integration

#### Theme Sync
```javascript
// In ThemeManager.js
async syncWithSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDarkMode = mediaQuery.matches;
    
    await this.setTheme(isDarkMode ? 'dark' : 'light', true);
    mediaQuery.addListener(this.handleSystemThemeChange.bind(this));
}
```

#### State Persistence
```javascript
// In ThemeManager.js
async saveThemePreference(theme, useSystem) {
    await chrome.storage.local.set({
        theme: theme,
        useSystemTheme: useSystem
    });
}

async loadThemePreference() {
    const { theme, useSystemTheme } = await chrome.storage.local.get(['theme', 'useSystemTheme']);
    return {
        theme: theme || 'light',
        useSystemTheme: useSystemTheme ?? true
    };
}
```

#### Event Propagation
```javascript
// In ThemeManager.js
async notifyThemeChange(theme) {
    const eventManager = await this.getDependency('event');
    await eventManager.emit('theme:changed', {
        theme,
        timestamp: new Date().toISOString()
    });
}