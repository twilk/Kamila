import { i18n } from './i18n.js';

export class UserManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    async initializeUserSelector() {
        const userSelect = document.getElementById('user-select');
        if (!userSelect) return;

        try {
            const { selectedUserId } = await chrome.storage.local.get('selectedUserId');

            userSelect.innerHTML = `<option value="" data-i18n="noUserSelected">${i18n.translate('noUserSelected')}</option>`;

            const userIds = [
                '2', '4', '5', '6', '7', '8', '9', '10', '11', '13', '14', '15', 
                '17', '18', '19', '23', '24', '25', '26', '27', '29', '31', '32', 
                '33', '34', '38', '39', '40', '42', '43', '47', '50', '55', '57', 
                '58', '60', '62', '65', '67', '69', '70', '71', '72', '73', '76', 
                '81', '82', '83', '84'
            ];

            const users = [];
            for (const userId of userIds) {
                const response = await fetch(chrome.runtime.getURL(`users/${userId}.json`));
                if (response.ok) {
                    const userData = await response.json();
                    users.push({ id: userId, ...userData });
                }
            }

            users.sort((a, b) => a.fullName.localeCompare(b.fullName));

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.fullName;
                if (selectedUserId === user.id) {
                    option.selected = true;
                    this.updateUserCard(user);
                }
                userSelect.appendChild(option);
            });

            userSelect.addEventListener('change', async (e) => {
                const selectedId = e.target.value;
                await chrome.storage.local.set({ selectedUserId: selectedId });
                
                if (selectedId) {
                    const selectedUser = users.find(u => u.id === selectedId);
                    if (selectedUser) {
                        this.updateUserCard(selectedUser);
                    }
                } else {
                    this.updateUserCard(null);
                }

                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH_USER_DATA' });
                });
            });

        } catch (error) {
            console.error('Error initializing user selector:', error);
            logToPanel('❌ Błąd podczas inicjalizacji selektora użytkowników', 'error', error);
        }
    }

    async updateUserCard(userData = null) {
        const cardInner = document.querySelector('.user-card-inner');
        const nameElement = document.querySelector('.user-card-front .user-name');
        const qrElement = document.querySelector('.user-card-back .qr-code');
        
        try {
            if (!userData) {
                const { selectedUserId } = await chrome.storage.local.get('selectedUserId');
                if (selectedUserId) {
                    const response = await fetch(chrome.runtime.getURL(`users/${selectedUserId}.json`));
                    if (response.ok) {
                        userData = await response.json();
                    }
                }
            }

            if (!userData) {
                if (nameElement) {
                    nameElement.textContent = i18n.translate('noUserSelected');
                }
                if (qrElement) {
                    qrElement.src = chrome.runtime.getURL('assets/default-avatar.jpg');
                }
                if (cardInner) {
                    cardInner.classList.add('no-user');
                }
                return;
            }

            if (nameElement) {
                nameElement.textContent = userData.fullName;
            }
            
            if (qrElement && userData.qrCodeUrl) {
                qrElement.src = `https://docs.google.com/thumbnail?id=${userData.qrCodeUrl}&sz=s1000`;
                qrElement.style.maxWidth = 'none';
                qrElement.style.width = '100%';
            }
            
            if (cardInner) {
                cardInner.classList.remove('no-user');
            }

            const cardFlip = document.querySelector('.user-card-flip');
            if (cardFlip) {
                cardFlip.addEventListener('click', () => {
                    cardInner.style.transform = 
                        cardInner.style.transform === 'rotateY(180deg)' ? 
                        'rotateY(0)' : 'rotateY(180deg)';
                });
            }
        } catch (error) {
            console.error('Error updating user card:', error);
            logToPanel('❌ Błąd aktualizacji karty użytkownika', 'error', error);
        }
    }
} 