import UserDataService from '../../services/userDataService';

describe('UserDataService', () => {
    let userDataService;
    
    beforeEach(() => {
        userDataService = new UserDataService();
        // Mock chrome.runtime.getURL
        global.chrome = {
            runtime: {
                getURL: (path) => `chrome-extension://fake-id/${path}`
            }
        };
    });

    afterEach(() => {
        userDataService.clearCache();
        jest.clearAllMocks();
    });

    test('should return user data from cache if available', async () => {
        const mockData = {
            memberId: '84',
            fullName: 'Test User'
        };
        userDataService.cache.set('84', mockData);

        const result = await userDataService.getUserByMemberId('84');
        expect(result).toEqual(mockData);
    });

    test('should fetch user data from file if not in cache', async () => {
        const mockData = {
            memberId: '84',
            fullName: 'Test User'
        };
        
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData)
            })
        );

        const result = await userDataService.getUserByMemberId('84');
        expect(result).toEqual(mockData);
        expect(userDataService.cache.get('84')).toEqual(mockData);
    });

    test('should return null if user not found', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false
            })
        );

        const result = await userDataService.getUserByMemberId('999');
        expect(result).toBeNull();
    });
}); 