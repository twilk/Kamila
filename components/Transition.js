/**
 * Komponent do obsługi animowanych przejść
 */
export class Transition {
    constructor(options = {}) {
        this.duration = options.duration || 200;
        this.timing = options.timing || 'ease-out';
        this.onBeforeEnter = options.onBeforeEnter || (() => {});
        this.onAfterEnter = options.onAfterEnter || (() => {});
        this.onBeforeLeave = options.onBeforeLeave || (() => {});
        this.onAfterLeave = options.onAfterLeave || (() => {});
    }

    /**
     * Animuje wejście elementu
     * @param {HTMLElement} element Element do animacji
     * @returns {Promise} Promise kończący się po zakończeniu animacji
     */
    enter(element) {
        return new Promise(resolve => {
            this.onBeforeEnter(element);

            // Dodaj klasy początkowe
            element.classList.add('fade-enter');
            element.style.display = '';

            // Force reflow
            element.offsetHeight;

            // Rozpocznij animację
            element.classList.add('fade-enter-active');
            element.classList.remove('fade-enter');

            // Nasłuchuj na zakończenie animacji
            const cleanup = () => {
                element.removeEventListener('transitionend', onEnd);
                element.removeEventListener('animationend', onEnd);
            };

            const onEnd = (event) => {
                if (event.target === element) {
                    cleanup();
                    element.classList.remove('fade-enter-active');
                    this.onAfterEnter(element);
                    resolve();
                }
            };

            element.addEventListener('transitionend', onEnd);
            element.addEventListener('animationend', onEnd);

            // Timeout jako zabezpieczenie
            setTimeout(() => {
                cleanup();
                resolve();
            }, this.duration + 50);
        });
    }

    /**
     * Animuje wyjście elementu
     * @param {HTMLElement} element Element do animacji
     * @returns {Promise} Promise kończący się po zakończeniu animacji
     */
    leave(element) {
        return new Promise(resolve => {
            this.onBeforeLeave(element);

            // Rozpocznij animację
            element.classList.add('fade-exit');
            
            // Force reflow
            element.offsetHeight;

            element.classList.add('fade-exit-active');
            element.classList.remove('fade-exit');

            // Nasłuchuj na zakończenie animacji
            const cleanup = () => {
                element.removeEventListener('transitionend', onEnd);
                element.removeEventListener('animationend', onEnd);
            };

            const onEnd = (event) => {
                if (event.target === element) {
                    cleanup();
                    element.classList.remove('fade-exit-active');
                    element.style.display = 'none';
                    this.onAfterLeave(element);
                    resolve();
                }
            };

            element.addEventListener('transitionend', onEnd);
            element.addEventListener('animationend', onEnd);

            // Timeout jako zabezpieczenie
            setTimeout(() => {
                cleanup();
                resolve();
            }, this.duration + 50);
        });
    }

    /**
     * Animuje przełączenie widoczności elementu
     * @param {HTMLElement} element Element do animacji
     * @param {boolean} show Czy element ma być widoczny
     * @returns {Promise} Promise kończący się po zakończeniu animacji
     */
    async toggle(element, show) {
        if (show) {
            return this.enter(element);
        } else {
            return this.leave(element);
        }
    }

    /**
     * Tworzy nową instancję z domyślnymi opcjami
     * @param {Object} options Opcje konfiguracyjne
     * @returns {Transition} Nowa instancja komponentu
     */
    static create(options = {}) {
        return new Transition(options);
    }
}

// Eksportuj domyślną instancję
export const transition = new Transition(); 