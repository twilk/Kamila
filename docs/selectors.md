# CSS Selectors Documentation

## Core Elements
### Base Layout
- `html, body` - Base reset and theme colors
- `body` - Window dimensions (800x600)
- `.container-fluid` - Main container with side panel offset

### Theme Support
- `body.dark-theme` - Dark theme base styles
- `.dark-theme #{selector}` - Dark theme variants for components

### Scrolling Behavior
- `#{container}::-webkit-scrollbar` - Hide scrollbars for main containers
  - Applied to: `.tab-content`, `.tab-pane`, `.container-fluid`, `body`, `html`
- `overscroll-behavior: none` - Prevent scroll chaining

## Components

### Side Panel (`#side-panel`)
- Fixed position on left side
- Width: 120px
- Full height with flex column layout
- Contains store selector and status indicators

### Menu Navigation
- `.menu` - Main menu container
  - Flex layout with centered items
  - Light/dark theme background
  - Border radius and shadow

- `.link` - Menu items
  - Default: Icon only (50px)
  - Hover/Active: Expands to show text (140px)
  - Smooth transitions for width/opacity

- `.link-icon` - Icon container
  - Centered 24x24px
  - Z-index handling for overlap

- `.link-title`/`.menu-text` - Text labels
  - Hidden by default (opacity: 0)
  - Visible on hover/active
  - Prevents text overflow

### Status Indicators
- `.lead-status` - Status item container
  - Flex layout with icon and counter
  - Hover transform effect

- `.lead-count` - Counter badges
  - Bold text with background color
  - Empty state styling
  - Animation on value change

### Store Selector
- `.store-selector` - Container
- `select` - Dropdown with custom arrow
- `#refresh-store-data` - Refresh button

### Debug Panel
- `.debug-panel` - Debug information container
  - Fixed position at bottom
  - Toggle visibility with debug mode
  - Scrollable content

## State Classes

### Interactive States
- `.active` - Current selection
- `.disabled` - Disabled elements
- `.has-count` - Elements with values
- `.no-count` - Empty state
- `:hover`, `:focus` - Interactive states

### Theme States
- `.dark-theme` - Dark mode styles
- `.debug-enabled` - Debug mode active

## Animations
```css
@keyframes countChange {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}
```

## Variables
```css
:root {
    /* Colors */
    --gray-{100-900}
    --primary, --success, --warning, etc.
    
    /* Theme */
    --bg-light/dark
    --text-light/dark
    --border-light/dark
    
    /* Dimensions */
    --window-height: 600px
    --debug-panel-height: 200px
    
    /* Other */
    --radius-sm/md/lg
    --transition-fast
}
```

## Cleanup Notes
1. Duplicate Selectors to Consolidate:
   - `.menu` and `.dark-theme .menu`
   - `.link` variants
   - `.link-icon` and text styles

2. Inconsistent Naming:
   - `.menu-text` vs `.link-title`
   - Dark theme class application

3. Optimization Opportunities:
   - Combine similar transitions
   - Standardize spacing values
   - Unify theme variable usage 