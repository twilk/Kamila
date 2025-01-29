### Menu Handling Analysis (Old Implementation)

#### 1. Core Menu Components
- **Store Selection**: Implemented via `initializeStoreSelect()` with dynamic store loading and persistent selection
- **Language Switcher**: Managed through `initializeLanguageSwitcher()` with support for multiple languages
- **Theme Switcher**: Light/dark theme toggle via `initializeThemeSwitcher()`
- **Debug Mode**: Controlled by `initializeDebugSwitch()` with password protection
- **Tab Navigation**: Implemented through `initializeTabs()` with dynamic content loading

#### 2. Key Features
- **Store Management**:
  - Dynamic store loading from configuration
  - Persistent store selection using chrome.storage.local
  - Automatic data refresh on store change
  - Support for "All Stores" option

- **Status Navigation**:
  - Click handling for both left and middle mouse buttons
  - Dynamic URL generation based on selected store
  - Support for different status types (submitted, confirmed, accepted, ready, overdue)
  - Integration with store selection for filtered views

- **UI Components**:
  - Bootstrap tooltips integration
  - Loading indicators for data updates
  - Error handling with user feedback
  - Responsive design elements

#### 3. Data Management
- **Lead Counts**:
  - Persistent storage of counter values
  - Automatic updates with change detection
  - Visual feedback for changes
  - Zero-state handling

- **DRWN Data**:
  - Dynamic data loading based on store selection
  - Filtering and processing of spreadsheet data
  - Error handling and loading states
  - Empty state management

#### 4. Comparison with Current Implementation
- **Simplifications**:
  - Old implementation uses direct DOM manipulation vs current component-based approach
  - Simpler event handling without complex state management
  - More straightforward store selection logic
  
- **Improvements Needed**:
  - Move to component-based architecture
  - Implement proper state management
  - Add type safety for menu interactions
  - Enhance error handling for menu operations

#### 5. Action Items
1. Implement proper TypeScript interfaces for menu state
2. Add error boundaries for menu components
3. Refactor store selection to use proper state management
4. Enhance menu accessibility features
5. Add proper event typing for menu interactions 

### Status Handling Analysis (Old Implementation)

#### 1. Status Navigation System
```javascript
// Core Status Navigation Logic
document.querySelectorAll('.lead-status').forEach(statusElement => {
    const dataStatus = statusElement.getAttribute('data-status');
    if (dataStatus) {
        statusElement.addEventListener('mousedown', (event) => {
            if (event.button === 0 || event.button === 1) {
                const storeSelect = document.getElementById('store-select');
                const selectedStore = storeSelect?.value;
                const selectedStoreId = selectedStore !== 'ALL' ? getStoreId(selectedStore) : null;
                const url = generateOrdersUrl(dataStatus, selectedStoreId || '0');
                
                // Handle different click types
                if (event.button === 1) {
                    window.open(url, '_blank');
                } else {
                    chrome.tabs.create({ url: url });
                }
            }
        });
    }
});
```

#### 2. Status URL Generation
```javascript
// URL Generation for Different Statuses
function generateOrdersUrl(status, storeId) {
    const baseUrl = 'https://darwina.pl/adm/';
    const params = new URLSearchParams({
        'a': 'zamowienia',
        'daid': storeId || '0'
    });

    switch (status) {
        case 'submitted':
            params.set('st', '1');
            params.set('s[]', '1');
            break;
        case 'confirmed':
            params.set('st', '2');
            params.set('s[]', '2');
            break;
        // ... other status cases
    }

    return `${baseUrl}?${params.toString()}`;
}
```

#### 3. Status Counter Updates
- **Counter Elements**: Each status has a dedicated counter element
- **Update Process**:
  1. Fetch new data from API
  2. Process status counts
  3. Update UI with new values
  4. Handle zero states
  5. Show visual feedback for changes

#### 4. Status-Related Features
- **Click Handling**:
  - Left click: Opens in current window
  - Middle click: Opens in new tab
  - Store-specific filtering
  
- **Visual Feedback**:
  - Loading indicators during updates
  - Counter animations on change
  - Zero state styling
  - Error state handling

#### 5. Status Data Flow
```javascript
// Status Data Pipeline
1. API Response → Raw Status Data
2. Status Processing → Counter Updates
3. UI Updates → Visual Feedback
4. Store Integration → Filtered Views
```

#### 6. Comparison with New Implementation
- **Advantages of Old Implementation**:
  - Simpler status mapping
  - Direct DOM updates
  - Clear event handling
  - Straightforward URL generation

- **Areas for Improvement**:
  - Add TypeScript type safety
  - Implement proper state management
  - Enhance error boundaries
  - Add loading states
  - Improve accessibility

#### 7. Status-Related Action Items
1. Implement TypeScript interfaces for status data
2. Add proper state management for status updates
3. Enhance error handling for status operations
4. Improve status navigation accessibility
5. Add comprehensive status change logging 

### Theme Switching Analysis (Old Implementation)

#### 1. Theme System Architecture
```javascript
// Core Theme Switching Logic
function initializeThemeSwitcher() {
    const lightTheme = document.getElementById('light-theme');
    const darkTheme = document.getElementById('dark-theme');

    // Initial Theme Setup
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', currentTheme === 'dark');

    // Theme Radio Selection
    if (currentTheme === 'dark') {
        darkTheme.checked = true;
    } else {
        lightTheme.checked = true;
    }

    // Theme Change Handlers
    function handleThemeChange(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
        localStorage.setItem('theme', theme);
        logToPanel(`🎨 Changed theme to: ${theme === 'dark' ? 'dark' : 'light'}`, 'success');
    }

    lightTheme.addEventListener('change', () => handleThemeChange('light'));
    darkTheme.addEventListener('change', () => handleThemeChange('dark'));
}
```

#### 2. Theme Storage
- **Storage Method**: Uses localStorage for theme persistence
- **Default Theme**: Light theme as fallback
- **Storage Key**: 'theme'
- **Values**: 'light' | 'dark'

#### 3. Theme Switching Process
1. **Initialization**:
   - Load saved theme from localStorage
   - Apply theme class to body
   - Set correct radio button state

2. **Theme Change**:
   - Toggle body class
   - Save new theme to localStorage
   - Log theme change
   - Update UI elements

#### 4. Theme-Related Features
- **Persistence**: Theme preference survives page reloads
- **Visual Feedback**: Immediate UI updates on theme change
- **Logging**: Theme changes are logged to panel
- **Fallback**: Default light theme if no preference set

#### 5. Theme Implementation Details
```css
/* Theme Classes */
body {
    /* Light theme defaults */
    --bg-color: #ffffff;
    --text-color: #000000;
    /* ... other variables */
}

body.dark-theme {
    /* Dark theme overrides */
    --bg-color: #1a1a1a;
    --text-color: #ffffff;
    /* ... other variables */
}
```

#### 6. Comparison with New Implementation
- **Advantages of Old Implementation**:
  - Simple theme switching logic
  - Direct CSS variable updates
  - Clear state management
  - Minimal dependencies

- **Areas for Improvement**:
  - Add system theme detection
  - Implement theme transition animations
  - Add theme-specific assets handling
  - Improve theme switching performance

#### 7. Theme-Related Action Items
1. Add system theme preference detection
2. Implement smooth theme transitions
3. Create theme-specific asset management
4. Add theme change event system
5. Implement theme-aware components 

### Debug Mode Analysis (Old Implementation)

#### 1. Debug Mode Architecture
```javascript
// Core Debug Mode Logic
function initializeDebugSwitch() {
    const debugSwitch = document.getElementById('debug-switch');
    if (!debugSwitch) return;

    // Initial State
    debugSwitch.checked = false;
    document.body.classList.remove('debug-enabled');
    chrome.storage.local.set({ debugMode: false });

    // Debug Switch Handler
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

#### 2. Debug Access Control
```javascript
// Password Verification
async function verifyDebugPassword() {
    const password = prompt(i18n.translate('debugPasswordPrompt'), '');
    return password === 'tango';
}

// Debug Access Check
async function checkDebugAccess() {
    const debugEnabled = document.body.classList.contains('debug-enabled');
    if (!debugEnabled) {
        if (await verifyDebugPassword()) {
            document.body.classList.add('debug-enabled');
            const debugSwitch = document.getElementById('debug-switch');
            if (debugSwitch) {
                debugSwitch.checked = true;
            }
            await chrome.storage.local.set({ debugMode: true });
            logToPanel(i18n.translate('debugEnabled'), 'success');
            return true;
        } else {
            alert(i18n.translate('debugPasswordIncorrect'));
            return false;
        }
    }
    return true;
}
```

#### 3. Debug Mode Features
- **State Management**:
  - Local storage persistence
  - Visual indicator in UI
  - Password protection
  - Logging system integration

- **Security Measures**:
  - Password verification
  - State validation
  - Access control
  - Session management

#### 4. Debug Panel Integration
```javascript
// Debug Panel Access Control
document.querySelector('.debug-panel')?.addEventListener('mouseenter', async (e) => {
    if (!document.body.classList.contains('debug-enabled')) {
        if (!await checkDebugAccess()) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    }
});
```

#### 5. Debug Mode States
1. **Disabled State**:
   - Debug panel hidden
   - Debug features inactive
   - Normal logging level

2. **Enabled State**:
   - Debug panel visible
   - Enhanced logging
   - Additional controls available
   - Developer tools accessible

#### 6. Comparison with New Implementation
- **Advantages of Old Implementation**:
  - Simple password protection
  - Clear state management
  - Direct DOM manipulation
  - Straightforward access control

- **Areas for Improvement**:
  - Enhance password security
  - Add session timeout
  - Implement proper auth system
  - Add debug level controls

#### 7. Debug-Related Action Items
1. Implement secure password storage
2. Add debug session management
3. Create debug level system
4. Enhance debug logging
5. Add debug tools API 

### Language Switching Analysis (Old Implementation)

#### 1. Language System Architecture
```javascript
// Core Language Switching Logic
function initializeLanguageSwitcher() {
    const languageButtons = document.querySelectorAll('[data-lang]');
    const currentLang = localStorage.getItem('language') || 'polish';

    // Initial Setup
    languageButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.lang === currentLang) {
            btn.classList.add('active');
        }

        // Click Handler
        btn.addEventListener('click', async function() {
            const lang = this.dataset.lang;
            languageButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            localStorage.setItem('language', lang);

            try {
                await i18n.init();
                updateInterface();
                initializeTooltips();
                logToPanel(`🌐 Changed language to: ${lang}`, 'success');
            } catch (error) {
                logToPanel('❌ Error changing language', 'error');
                console.error('Language switch error:', error);
            }
        });
    });

    // Initialize tooltips
    initializeTooltips();
}
```

#### 2. Translation System
```javascript
// i18n Implementation
const i18n = {
    translations: {},
    currentLang: 'polish',

    async init() {
        const lang = localStorage.getItem('language') || 'polish';
        try {
            const response = await fetch(`locales/${lang}.json`);
            this.translations = await response.json();
            this.currentLang = lang;
        } catch (error) {
            console.error('Translation load error:', error);
            throw error;
        }
    },

    translate(key, params = {}) {
        let text = this.get(key);
        Object.entries(params).forEach(([key, value]) => {
            text = text.replace(`{${key}}`, value);
        });
        return text;
    },

    get(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.translations) || key;
    }
}
```

#### 3. Language-Related Features
- **State Management**:
  - Local storage persistence
  - Active language indication
  - Dynamic translation loading
  - Error handling

- **UI Updates**:
  - Interface text updates
  - Tooltip refreshing
  - Visual feedback
  - Loading states

#### 4. Translation Structure
```javascript
// Translation File Format (locales/polish.json)
{
    "leadStatuses": {
        "submitted": "Złożone",
        "confirmed": "Potwierdzone",
        "accepted": "Przyjęte",
        "ready": "Gotowe do odbioru",
        "overdue": "Przeterminowane"
    },
    "messages": {
        "errorWallpaperLoad": "Błąd ładowania tapety",
        "successWallpaperUpdate": "Tapeta zaktualizowana",
        "debugEnabled": "Tryb debugowania włączony",
        "debugDisabled": "Tryb debugowania wyłączony"
    }
}
```

#### 5. Language Switch Process
1. **Initialization**:
   - Load saved language preference
   - Set active language button
   - Initialize translations

2. **Language Change**:
   - Update active button state
   - Save new language preference
   - Load new translations
   - Update UI elements
   - Refresh tooltips

#### 6. Comparison with New Implementation
- **Advantages of Old Implementation**:
  - Simple language switching
  - Clear translation structure
  - Direct file loading
  - Straightforward state management

- **Areas for Improvement**:
  - Add language fallback chain
  - Implement lazy translation loading
  - Add translation caching
  - Improve error recovery

#### 7. Language-Related Action Items
1. Implement language fallback system
2. Add translation caching mechanism
3. Create translation validation
4. Add missing translation detection
5. Implement translation hot reload 