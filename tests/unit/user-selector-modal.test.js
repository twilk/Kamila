import { UserSelectorModal } from '../../components/user-selector-modal';

describe('UserSelectorModal', () => {
    let modal;
    let users;

    beforeEach(() => {
        modal = new UserSelectorModal();
        users = [
            { memberId: '1', firstName: 'Jan', lastName: 'Kowalski' },
            { memberId: '2', firstName: 'Anna', lastName: 'Nowak' }
        ];
    });

    test('should create modal with user list', () => {
        modal.show(users, jest.fn());
        
        const userItems = document.querySelectorAll('.user-item');
        expect(userItems).toHaveLength(2);
        expect(userItems[0].textContent).toContain('Jan Kowalski');
    });

    test('should call callback on user selection', () => {
        const callback = jest.fn();
        modal.show(users, callback);

        const firstUser = document.querySelector('.user-item');
        firstUser.click();

        expect(callback).toHaveBeenCalledWith('1');
    });

    test('should close on escape key', () => {
        modal.show(users, jest.fn());
        
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        modal.modal.dispatchEvent(event);

        expect(document.querySelector('.user-selector-modal')).toBeNull();
    });
}); 