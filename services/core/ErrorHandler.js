import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';

/**
 * Klasa reprezentująca błąd aplikacji
 */
export class AppError extends Error {
    constructor(message, type = ErrorType.UNKNOWN, severity = ErrorSeverity.ERROR, context = {}) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.severity = severity;
        this.context = context;
        this.timestamp = Date.now();
    }
}

/**
 * Handler błędów aplikacji
 */
export class ErrorHandler extends BaseManager {
    constructor() {
        super('ErrorHandler');
        this.errors = [];
        this.maxErrors = 100; // Maksymalna liczba przechowywanych błędów
        this.listeners = new Set();
    }

    /**
     * Inicjalizacja handlera
     */
    async initialize() {
        try {
            await super.initialize();
            
            // Inicjalizacja nasłuchiwania na globalne błędy
            window.addEventListener('error', this.handleGlobalError.bind(this));
            window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
            
            // Nadpisanie console.error
            const originalConsoleError = console.error;
            console.error = (...args) => {
                this.handleConsoleError(...args);
                originalConsoleError.apply(console, args);
            };

            return true;
        } catch (error) {
            console.error('Failed to initialize ErrorHandler:', error);
            return false;
        }
    }

    /**
     * Obsługa błędu
     */
    handleError(error, type = ErrorType.UNKNOWN, severity = ErrorSeverity.ERROR, context = {}) {
        const appError = error instanceof AppError ? 
            error : 
            new AppError(error.message || String(error), type, severity, {
                ...context,
                originalError: error
            });

        // Dodaj błąd do historii
        this.errors.unshift(appError);
        
        // Zachowaj limit błędów
        if (this.errors.length > this.maxErrors) {
            this.errors.pop();
        }

        // Powiadom listenery
        this.notifyListeners(appError);

        // Logowanie do konsoli
        this.logError(appError);

        return appError;
    }

    /**
     * Obsługa błędów globalnych
     */
    handleGlobalError(event) {
        event.preventDefault();
        this.handleError(event.error || new Error(event.message), ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }

    /**
     * Obsługa nieobsłużonych promise rejection
     */
    handleUnhandledRejection(event) {
        event.preventDefault();
        this.handleError(event.reason, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
            unhandledRejection: true
        });
    }

    /**
     * Obsługa console.error
     */
    handleConsoleError(...args) {
        const error = args[0] instanceof Error ? args[0] : new Error(args.join(' '));
        this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
            consoleError: true,
            args: args
        });
    }

    /**
     * Dodaj listener błędów
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Powiadom listenery o błędzie
     */
    notifyListeners(error) {
        this.listeners.forEach(listener => {
            try {
                listener(error);
            } catch (listenerError) {
                console.error('Error in error listener:', listenerError);
            }
        });
    }

    /**
     * Logowanie błędu
     */
    logError(error) {
        const timestamp = new Date(error.timestamp).toISOString();
        const context = JSON.stringify(error.context, null, 2);
        
        console.group(`🚨 [${error.severity.toUpperCase()}] ${error.type}`);
        console.log(`⏰ Time:`, timestamp);
        console.log(`❌ Error:`, error.message);
        console.log(`📋 Context:`, context);
        if (error.stack) {
            console.log(`📚 Stack:`, error.stack);
        }
        console.groupEnd();
    }

    /**
     * Pobierz historię błędów
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * Wyczyść historię błędów
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Dispose
     */
    dispose() {
        try {
            window.removeEventListener('error', this.handleGlobalError);
            window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
            this.listeners.clear();
            this.errors = [];
            super.dispose();
        } catch (error) {
            console.error('Failed to dispose ErrorHandler:', error);
        }
    }
} 