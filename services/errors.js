export class ApiError extends Error {
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'ApiError';
    }
}

export const HTTP_ERRORS = {
    400: 'Nieprawidłowe żądanie',
    401: 'Brak autoryzacji',
    403: 'Brak dostępu',
    404: 'Nie znaleziono zasobu',
    429: 'Zbyt wiele zapytań',
    500: 'Błąd serwera',
    503: 'Usługa niedostępna'
}; 