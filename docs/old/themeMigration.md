# Theme Implementation Migration Plan

## Current State

### 1. Implementations
- **InterfaceManager.js**: Uses `.dark-theme` class toggle
- **ThemeManager.js**: Uses `[data-theme="dark"]` attribute (target implementation)

### 2. Files to Update
1. JavaScript Files:
   - `services/core/InterfaceManager.js`
   - `services/core/UIManager.js`

2. CSS Files:
   - `style.css` (21 selectors)
   - `styles/test.css` (8 selectors)
   - `styles/theme.css` (2 selectors)
   - `styles/messages.css` (1 selector)
   - `styles/counters.css` (8 selectors)

## Migration Steps

### Phase 1: JavaScript Updates

1. Update InterfaceManager.js:
   ```javascript
   initializeThemeSwitcher() {
       const lightTheme = document.getElementById('light-theme');
       const darkTheme = document.getElementById('dark-theme');
       
       if (!lightTheme || !darkTheme) return;

       // Use ThemeManager instead of direct class toggle
       const currentTheme = localStorage.getItem('theme') || 'light';
       themeManager.setTheme(currentTheme);
       
       if (currentTheme === 'dark') {
           darkTheme.checked = true;
       } else {
           lightTheme.checked = true;
       }

       const handleThemeChange = (theme) => {
           themeManager.setTheme(theme);
           
           // Event emission is now handled by ThemeManager
       };

       lightTheme.addEventListener('change', () => handleThemeChange('light'));
       darkTheme.addEventListener('change', () => handleThemeChange('dark'));
   }
   ```

2. Update UIManager.js:
   ```javascript
   async handleThemeToggle(event) {
       try {
           const button = event.target;
           const currentTheme = themeManager.getCurrentTheme();
           const newTheme = currentTheme === 'light' ? 'dark' : 'light';
           
           await themeManager.setTheme(newTheme);
           button.setAttribute('aria-pressed', String(newTheme === 'dark'));

           this.log(LogLevel.DEBUG, '🎨 Theme toggled', { theme: newTheme });
       } catch (error) {
           this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
               method: 'handleThemeToggle'
           });
       }
   }
   ```

### Phase 2: CSS Migration

1. Create CSS Migration Function:
   ```javascript
   async migrateThemeStyles() {
       const files = [
           'style.css',
           'styles/test.css',
           'styles/theme.css',
           'styles/messages.css',
           'styles/counters.css'
       ];
       
       for (const file of files) {
           // Read file content
           const content = await readFile(file);
           
           // Replace selectors
           const updatedContent = content
               .replace(/\.dark-theme\s/g, '[data-theme="dark"] ')
               .replace(/body\.dark-theme\s/g, 'body[data-theme="dark"] ');
           
           // Write updated content
           await writeFile(file, updatedContent);
       }
   }
   ```

2. CSS Selector Updates:
   - `.dark-theme` → `[data-theme="dark"]`
   - `body.dark-theme` → `body[data-theme="dark"]`
   - `.dark-theme .selector` → `[data-theme="dark"] .selector`

3. Handle Duplicates:
   - `.dark-theme .nav-tabs .nav-link` (style.css: 243, 744)
   - `.dark-theme .lead-status` (style.css: 320, theme.css: 120)
   - `.dark-theme .lead-count` (style.css: 304, theme.css: 137)

### Phase 3: Testing

1. Functional Testing:
   - Theme switching
   - System theme detection
   - Theme persistence
   - UI updates
   - Event handling

2. Visual Testing:
   - All components in light mode
   - All components in dark mode
   - Transition animations
   - System theme changes

3. Performance Testing:
   - Theme switch response time
   - Style application speed
   - Memory usage

### Phase 4: Cleanup

1. Remove Old Code:
   - Delete unused theme toggle functions
   - Remove duplicate CSS selectors
   - Clean up old event listeners

2. Documentation Updates:
   - Update JSDoc comments
   - Update README
   - Update theme-related documentation

3. Final Verification:
   - No references to `.dark-theme`
   - All components using `[data-theme="dark"]`
   - No regressions in functionality

## Timeline

1. Phase 1 (JavaScript Updates): 1 day
   - Update managers
   - Test functionality
   - Fix any issues

2. Phase 2 (CSS Migration): 2 days
   - Create migration script
   - Run migrations
   - Manual review and fixes

3. Phase 3 (Testing): 1 day
   - Run all tests
   - Visual verification
   - Performance testing

4. Phase 4 (Cleanup): 1 day
   - Code cleanup
   - Documentation
   - Final verification

Total estimated time: 5 days

## Rollback Plan

1. Keep backup of all modified files
2. Maintain old theme implementation until migration is complete
3. Test rollback procedure before starting migration
4. Document any issues encountered during migration

## Success Criteria

1. All theme changes use ThemeManager
2. No `.dark-theme` selectors in codebase
3. All tests passing
4. No visual regressions
5. Improved or equal performance
6. Complete documentation 