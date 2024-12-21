export class UserCard {
    constructor(container) {
        this.container = container;
        this.cardElement = null;
        this.currentUser = null;
        this.isFlipped = false;
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        this.cardElement = this.createCardElement();
        this.container.appendChild(this.cardElement);
        
        // Load current user
        const currentUserId = await UserCardsService.getCurrentUser();
        if (currentUserId) {
            const cards = await UserCardsService.getAllCards();
            const userData = cards.find(card => card.memberId === currentUserId);
            if (userData) {
                this.updateCard(userData);
            }
        }

        this.setupEventListeners();
    }

    createCardElement() {
        const card = document.createElement('div');
        card.className = 'user-card-flip';
        card.innerHTML = `
            <div class="user-card-inner">
                <div class="user-card-front">
                    <span class="user-name">-</span>
                    <button class="switch-user-btn" aria-label="Switch User">
                        <i class="bi bi-person-switch"></i>
                    </button>
                </div>
                <div class="user-card-back">
                    <div class="qr-container">
                        <img src="" alt="QR Code" class="qr-code" />
                    </div>
                </div>
            </div>
        `;
        return card;
    }

    setupEventListeners() {
        this.cardElement.addEventListener('click', () => {
            this.toggleFlip();
        });

        const switchBtn = this.cardElement.querySelector('.switch-user-btn');
        switchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showUserSelector();
        });
    }

    async updateCard(userData) {
        this.currentUser = userData;
        this.isLoading = true;
        
        // Update front
        const nameElement = this.cardElement.querySelector('.user-name');
        nameElement.textContent = `${userData.firstName} ${userData.lastName}`;

        // Update QR with loading state
        const qrContainer = this.cardElement.querySelector('.qr-container');
        qrContainer.innerHTML = `
            <div class="qr-loading">
                <div class="spinner-border spinner-border-sm" role="status">
                    <span class="visually-hidden">Generowanie kodu QR...</span>
                </div>
                <div class="mt-2">Generowanie kodu QR...</div>
            </div>
        `;
        
        try {
            const qrCode = await UserCardsService.generateQRCode(userData);
            if (qrCode) {
                qrContainer.innerHTML = `
                    <img src="${qrCode}" 
                         alt="QR Code" 
                         class="qr-code"
                         aria-label="Kod QR dla ${userData.firstName} ${userData.lastName}" />
                `;
            } else {
                this.showError(qrContainer, 'Nie udało się wygenerować kodu QR');
            }
        } catch (error) {
            console.error('Error updating QR code:', error);
            this.showError(qrContainer, 'Błąd podczas generowania kodu QR');
        } finally {
            this.isLoading = false;
        }

        // Announce change
        accessibilityService.announce(
            i18n.translate('userCard.switched', { name: userData.firstName })
        );
    }

    showError(container, message) {
        container.innerHTML = `
            <div class="qr-error" role="alert">
                <i class="bi bi-exclamation-triangle"></i>
                <div>${message}</div>
                <button class="btn btn-sm btn-outline-primary mt-2 retry-btn">
                    <i class="bi bi-arrow-clockwise"></i>
                    Spróbuj ponownie
                </button>
            </div>
        `;

        container.querySelector('.retry-btn')?.addEventListener('click', () => {
            if (this.currentUser) {
                this.updateCard(this.currentUser);
            }
        });
    }

    toggleFlip() {
        if (!this.currentUser || this.isLoading) return;
        
        this.isFlipped = !this.isFlipped;
        this.cardElement.classList.toggle('flipped', this.isFlipped);

        // Announce for screen readers
        accessibilityService.announce(
            i18n.translate(
                this.isFlipped ? 'userCard.showingQR' : 'userCard.showingInfo'
            )
        );
    }

    async showUserSelector() {
        const cards = await UserCardsService.getAllCards();
        if (!cards.length) {
            // Show add user dialog
            return;
        }

        // Create and show selector modal
        const modal = new Modal('user-selector-modal');
        modal.show(cards, async (selectedId) => {
            if (selectedId) {
                const userData = cards.find(card => card.memberId === selectedId);
                await UserCardsService.setCurrentUser(selectedId);
                this.updateCard(userData);
            }
        });
    }
} 