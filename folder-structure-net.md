# KAMILA Project Structure Network

## Core Services Dependencies

### ThemeManager (services/theme.manager.js)
- Dependencies:
  - AccessibilityService
  - I18nService
  - PerformanceMonitor
  - ApiService
- Provides:
  - Theme state management
  - Color customization
  - Theme persistence
  - Server synchronization

### ThemePanel (services/theme.panel.js)
- Dependencies:
  - ThemeManager (singleton)
  - AccessibilityService
  - I18nService
- Manages:
  - Color picker UI
  - Panel animations
  - Focus trap
  - Drag functionality

### AccessibilityService (services/accessibility.js)
- Independent service
- Provides:
  - Focus trap management
  - Screen reader announcements
  - Color contrast validation
  - Reduced motion detection

## CSS Hierarchy

### Theme System 

### CSS Variables Structure