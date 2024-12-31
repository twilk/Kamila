export class ApiError extends Error {
    constructor(message, statusCode, data = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.data = data;
    }
}

export class ValidationError extends Error {
    constructor(message, validationErrors = []) {
        super(message);
        this.name = 'ValidationError';
        this.validationErrors = validationErrors;
    }
}

export class NetworkError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = 'NetworkError';
        this.originalError = originalError;
    }
}

export class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class CacheError extends Error {
    constructor(message, key = null) {
        super(message);
        this.name = 'CacheError';
        this.key = key;
    }
}

export class DatabaseError extends Error {
    constructor(message, operation = null) {
        super(message);
        this.name = 'DatabaseError';
        this.operation = operation;
    }
} 