# Imports Analysis

## Core Files

### popup.js
Imports from:
- `./services/index.js`
- `./config/api.js`
- `./services/i18n.js`
- `./services/userCard.js`
- `./services/drwn.js`
- `./services/api.js`
- `./config/stores.js`
- `./services/updateManager.js`
- `./services/progressManager.js`
- `./services/storage.js`
- `./services/uiManager.js`
- `./services/dataManager.js`
- `./services/statusManager.js`
- `./services/debugManager.js`
- `./services/userManager.js`
- `./services/interfaceManager.js`
- `./services/testRunner.js`
- `./tests/integration/translation.test.js`

## Additional Files Found in /services
Not listed in imports but present:
- `sellyApi.js`
- `users.js`
- `wallpaperManager.js`
- `wallpaper.js`
- `theme.js`
- `userDataService.js`
- `statusChecker.js`
- `darwinApi.js`

## Config Directory (`/config`)
Required files:
- `api.js`
- `stores.js`

Additional files found:
- `i18n.js` (potential duplicate with /services/i18n.js)
- `credentials.json`
- `delivery.js`

## Files Missing from /services
These files need to be moved from /src/popup/components:
- `uiManager.js`
- `statusManager.js`
- `debugManager.js`
- `userManager.js`
- `interfaceManager.js`

## Files Missing from /src/utils
These files need to be moved to /services:
- `asyncOperationManager.js`
- `benchmarkManager.js`
- `cacheManager.js`
- `componentState.js`

## Reorganizacja folderu src

### 1. Przeniesienie plików z src/popup/components do /services:
```bash
mv src/popup/components/uiManager.js services/
mv src/popup/components/statusManager.js services/
mv src/popup/components/debugManager.js services/
mv src/popup/components/userManager.js services/
mv src/popup/components/interfaceManager.js services/
mv src/popup/components/dataManager.js services/
mv src/popup/components/updateManager.js services/
```

### 2. Przeniesienie plików z src/utils do /services:
```bash
mv src/utils/asyncOperationManager.js services/
mv src/utils/benchmarkManager.js services/
mv src/utils/cacheManager.js services/
mv src/utils/componentState.js services/
```

### 3. Przeniesienie plików z src/services do /services:
```bash
mv src/services/i18n.js services/
mv src/services/progressManager.js services/
```

### 4. Usunięcie pustych katalogów:
```bash
rm -r src/popup/components
rm -r src/utils
rm -r src/services
rm -r src/popup
rm -r src
```

## Aktualizacja importów w plikach

### popup.js
Zmienić importy z:
```javascript
import { UIManager } from './src/popup/components/uiManager.js';
import { DataManager } from './src/popup/components/dataManager.js';
import { StatusManager } from './src/popup/components/statusManager.js';
import { DebugManager } from './src/popup/components/debugManager.js';
import { UserManager } from './src/popup/components/userManager.js';
import { InterfaceManager } from './src/popup/components/interfaceManager.js';
```
na:
```javascript
import { UIManager } from './services/uiManager.js';
import { DataManager } from './services/dataManager.js';
import { StatusManager } from './services/statusManager.js';
import { DebugManager } from './services/debugManager.js';
import { UserManager } from './services/userManager.js';
import { InterfaceManager } from './services/interfaceManager.js';
```

### Sprawdzić i zaktualizować importy w:
1. `services/dataManager.js`
2. `services/debugManager.js`
3. `services/interfaceManager.js`
4. `services/statusManager.js`
5. `services/uiManager.js`
6. `services/userManager.js`
7. `services/updateManager.js`

## Kolejność działań

1. Najpierw skopiować wszystkie pliki (backup)
2. Przenieść pliki z src do services
3. Zaktualizować importy w popup.js
4. Zaktualizować importy w przeniesionych plikach
5. Sprawdzić czy wszystko działa
6. Usunąć katalog src

## Weryfikacja po zmianach

1. Sprawdzić czy wszystkie pliki są w /services
2. Sprawdzić czy wszystkie importy działają
3. Sprawdzić czy nie ma duplikatów plików
4. Sprawdzić czy aplikacja działa poprawnie
5. Sprawdzić czy nie ma błędów w konsoli 