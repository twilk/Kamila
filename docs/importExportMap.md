# Import/Export Map

## Core Services

### LogLevel (`services/core/LogLevel.js`)
**Exports:**
- `LogLevel` (enum)

**Imported by:**
- `services/core/BaseLogger.js`
- `services/core/BaseManager.js`
- `services/core/ConnectionManager.js`
- `services/core/DebugManager.js`
- `services/core/DependencyValidator.js`
- `services/core/ErrorHandler.js`
- `services/core/EventManager.js`
- `services/core/ManagerGroup.js`
- `services/core/MessageManager.js`
- `services/api/OrderService.js`

### ErrorTypes (`services/core/ErrorTypes.js`)
**Exports:**
- `ErrorType` (enum)
- `ErrorSeverity` (enum)
- `ErrorRecoveryStrategy` (enum)
- `AppError` (class)

**Imported by:**
- `services/core/BaseManager.js`
- `services/core/ConnectionManager.js`
- `services/core/DebugManager.js`
- `services/core/DependencyValidator.js`
- `services/core/ErrorHandler.js`
- `services/core/EventManager.js`
- `services/core/ManagerGroup.js`
- `services/core/MessageManager.js`
- `services/api/OrderService.js`

### BaseManager (`services/core/BaseManager.js`)
**Exports:**
- `BaseManager` (class)

**Imported by:**
- `services/core/ConnectionManager.js`
- `services/core/DebugManager.js`
- `services/core/ErrorHandler.js`
- `services/core/EventManager.js`
- `services/core/ManagerGroup.js`
- `services/core/MessageManager.js`
- `services/core/ProgressManager.js`
- `services/core/StoreManager.js`
- `services/core/UIManager.js`
- `services/core/UserManager.js`
- `services/api/OrderService.js`

### ErrorHandler (`services/core/ErrorHandler.js`)
**Exports:**
- `ErrorHandler` (class)
- `errorHandler` (singleton instance)

**Imported by:**
- `services/core/BaseManager.js`
- `services/core/UIManager.js`

### EventManager (`services/core/EventManager.js`)
**Exports:**
- `EventManager` (class)
- `eventManager` (singleton instance)

**Imported by:**
- `services/core/ConnectionManager.js`
- `services/core/UIManager.js`
- `services/core/StoreManager.js`

### MessageManager (`services/core/MessageManager.js`)
**Exports:**
- `MessageManager` (class)
- `messageManager` (singleton instance)

**Imported by:**
- `services/core/UIManager.js`

### UIManager (`services/core/UIManager.js`)
**Exports:**
- `UIManager` (class)
- `uiManager` (singleton instance)

**Imported by:**
- `services/core/StoreManager.js`
- `services/core/ProgressManager.js`

### ProgressManager (`services/core/ProgressManager.js`)
**Exports:**
- `ProgressManager` (class)
- `progressManager` (singleton instance)

**Imported by:**
- `services/core/DataManager.js`

### StoreManager (`services/core/StoreManager.js`)
**Exports:**
- `StoreManager` (class)
- `storeManager` (singleton instance)

**Imported by:**
- `services/core/DataManager.js`

### UserManager (`services/core/UserManager.js`)
**Exports:**
- `UserManager` (class)
- `userManager` (singleton instance)

**Imported by:**
- `services/core/UIManager.js`

## API Services

### OrderService (`services/api/OrderService.js`)
**Exports:**
- `OrderService` (class)

**Imported by:**
- `services/core/DataManager.js`

### API Service (`services/api/api.js`)
**Exports:**
- `API` (singleton instance)
- `APIService` (class)

**Imported by:**
- `services/core/DataManager.js`
- `services/core/StoreManager.js`

## Configuration

### API Config (`config/api.js`)
**Exports:**
- `API_CONFIG` (object)

**Imported by:**
- `services/core/ConnectionManager.js`
- `services/api/OrderService.js`
- `services/api/api.js`

## Dependencies Graph

```mermaid
graph TD
    %% Core Services
    subgraph Core["Core Services"]
        direction TB
        LogLevel --> BaseLogger
        LogLevel --> BaseManager
        LogLevel --> ConnectionManager
        LogLevel --> DebugManager
        LogLevel --> DependencyValidator
        LogLevel --> ErrorHandler
        LogLevel --> EventManager
        LogLevel --> ManagerGroup
        LogLevel --> MessageManager
        LogLevel --> OrderService

        ErrorTypes --> BaseManager
        ErrorTypes --> ConnectionManager
        ErrorTypes --> DebugManager
        ErrorTypes --> DependencyValidator
        ErrorTypes --> ErrorHandler
        ErrorTypes --> EventManager
        ErrorTypes --> ManagerGroup
        ErrorTypes --> MessageManager
        ErrorTypes --> OrderService

        BaseManager --> ConnectionManager
        BaseManager --> DebugManager
        BaseManager --> ErrorHandler
        BaseManager --> EventManager
        BaseManager --> ManagerGroup
        BaseManager --> MessageManager
        BaseManager --> ProgressManager
        BaseManager --> StoreManager
        BaseManager --> UIManager
        BaseManager --> UserManager
        BaseManager --> OrderService

        ErrorHandler --> BaseManager
        ErrorHandler --> UIManager

        EventManager --> ConnectionManager
        EventManager --> UIManager
        EventManager --> StoreManager

        MessageManager --> UIManager

        UIManager --> StoreManager
        UIManager --> ProgressManager

        UserManager --> UIManager
    end

    %% API Services
    subgraph API["API Services"]
        direction TB
        OrderService --> DataManager
        API --> DataManager
        API --> StoreManager
    end

    %% Configuration
    subgraph Config["Configuration"]
        direction TB
        API_CONFIG --> ConnectionManager
        API_CONFIG --> OrderService
        API_CONFIG --> API
    end

    %% Style definitions
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px;
    classDef core fill:#e1f3d8,stroke:#333,stroke-width:1px;
    classDef api fill:#d8e5f3,stroke:#333,stroke-width:1px;
    classDef config fill:#f3e4d8,stroke:#333,stroke-width:1px;

    %% Apply styles
    class Core core;
    class API api;
    class Config config;
``` 