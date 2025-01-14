import { ACTIVE_USERS, generateUserJson, getUserByMemberId } from '../../services/users.js';

describe('Users Service', () => {
    beforeEach(() => {
        // Mock chrome.runtime.getURL
        global.chrome = {
            runtime: {
                getURL: jest.fn(path => `mock://extension/${path}`)
            }
        };

        // Mock fetch
        global.fetch = jest.fn();
    });

    describe('ACTIVE_USERS', () => {
        test('should contain all required users', () => {
            expect(ACTIVE_USERS).toBeInstanceOf(Array);
            expect(ACTIVE_USERS.length).toBeGreaterThan(0);
            
            // Check if array contains required managers
            const managers = ACTIVE_USERS.filter(user => user.isManager);
            expect(managers.length).toBeGreaterThan(0);
            
            // Check user object structure
            ACTIVE_USERS.forEach(user => {
                expect(user).toHaveProperty('fullName');
                expect(user).toHaveProperty('memberId');
                expect(user).toHaveProperty('isManager');
                expect(typeof user.fullName).toBe('string');
                expect(typeof user.memberId).toBe('string');
                expect(typeof user.isManager).toBe('boolean');
            });
        });

        test('should have unique member IDs', () => {
            const memberIds = ACTIVE_USERS.map(user => user.memberId);
            const uniqueIds = new Set(memberIds);
            expect(uniqueIds.size).toBe(memberIds.length);
        });
    });

    describe('generateUserJson', () => {
        test('should generate correct user JSON', () => {
            const testUser = {
                fullName: 'Test User',
                memberId: '999',
                isManager: true
            };

            const result = generateUserJson(testUser);

            expect(result).toEqual({
                status: 'Aktywny',
                fullName: 'Test User',
                memberId: '999',
                isManager: true
            });
        });

        test('should handle all user properties', () => {
            ACTIVE_USERS.forEach(user => {
                const result = generateUserJson(user);
                expect(result).toHaveProperty('status', 'Aktywny');
                expect(result).toHaveProperty('fullName', user.fullName);
                expect(result).toHaveProperty('memberId', user.memberId);
                expect(result).toHaveProperty('isManager', user.isManager);
            });
        });
    });

    describe('getUserByMemberId', () => {
        test('should fetch user data successfully', async () => {
            const mockUser = {
                status: 'Aktywny',
                fullName: 'Test User',
                memberId: '123',
                isManager: false
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockUser)
            });

            const result = await getUserByMemberId('123');
            expect(result).toEqual(mockUser);
            expect(chrome.runtime.getURL).toHaveBeenCalledWith('users/123.json');
        });

        test('should handle non-existent user', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false
            });

            const result = await getUserByMemberId('999');
            expect(result).toBeNull();
        });

        test('should handle fetch errors', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await getUserByMemberId('123');
            expect(result).toBeNull();
        });

        test('should handle invalid JSON', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.reject(new Error('Invalid JSON'))
            });

            const result = await getUserByMemberId('123');
            expect(result).toBeNull();
        });
    });
}); 