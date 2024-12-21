import { i18n } from '../services/i18n.js';
import { accessibilityService } from '../services/accessibility.js';

export class UserSelectorModal {
    constructor() {
        this.modal = null;
        this.callback = null;
    }

    show(users, onSelect) {
        this.callback = onSelect;
        this.createModal(users);
        this.setupEventListeners();
        this.modal.classList.add('show');
        accessibilityService.announce(i18n.translate('userSelector.opened'));
    }

    createModal(users) {
        this.modal = document.createElement('div');
        this.modal.className = 'modal user-selector-modal';
        this.modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" data-i18n="userSelector.title">
                        Wybierz użytkownika
                    </h5>
                    <button type="button" class="btn-close" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="user-list">
                        ${users.map(user => `
                            <button class="user-item" data-user-id="${user.memberId}">
                                <span class="user-name">${user.firstName} ${user.lastName}</span>
                                <small class="user-id">#${user.memberId}</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
    }

    setupEventListeners() {
        // Close button
        this.modal.querySelector('.btn-close').addEventListener('click', () => {
            this.hide();
        });

        // User selection
        this.modal.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                this.callback?.(userId);
                this.hide();
            });
        });

        // Click outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Keyboard navigation
        this.modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });
    }

    hide() {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.remove();
            this.modal = null;
            this.callback = null;
        }, 300);
    }
} 