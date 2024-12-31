import { retryUtils } from '../../utils/retryUtils.js';
import { errorUtils } from '../../utils/errorUtils.js';
import { logService } from '../../services/LogService.js';
import { retryService } from '../../services/RetryService.js';
import { ApiError } from '../../services/ErrorService.js';

describe('RetryStrategy', () => {
    let retry;

    beforeEach(() => {
        retry = retryService;
        retry.reset();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should retry specified number of times', async () => {
        const mockOperation = jest.fn()
            .mockRejectedValueOnce(new ApiError('Error', 500))
            .mockRejectedValueOnce(new ApiError('Error', 500))
            .mockResolvedValueOnce('success');

        const promise = retry.execute(mockOperation);
        for (let i = 0; i < 2; i++) {
            jest.advanceTimersByTime(100 * Math.pow(2, i));
            await Promise.resolve();
        }

        const result = await promise;
        expect(result).toBe('success');
        expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    test('should not retry on client errors', async () => {
        const mockOperation = jest.fn()
            .mockRejectedValueOnce(new ApiError('Error', 400));

        await expect(retry.execute(mockOperation))
            .rejects
            .toThrow(ApiError);
        expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should implement exponential backoff', async () => {
        const mockOperation = jest.fn()
            .mockRejectedValue(new ApiError('Error', 500));

        const promise = retry.execute(mockOperation);
        
        // First retry after 100ms
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        
        // Second retry after 200ms
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        
        // Third retry after 400ms
        jest.advanceTimersByTime(400);
        await Promise.resolve();

        await expect(promise).rejects.toThrow();
        expect(mockOperation).toHaveBeenCalledTimes(3);
    });
}); 