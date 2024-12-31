/**
 * Komponent do obsługi animowanych liczników
 */
export class Counter {
    constructor(options = {}) {
        this.duration = options.duration || 500;
        this.easing = options.easing || this.easeOutExpo;
        this.formatValue = options.formatValue || (value => Math.round(value).toString());
        this.onUpdate = options.onUpdate || (() => {});
    }

    /**
     * Animuje zmianę wartości licznika
     * @param {HTMLElement} element Element do aktualizacji
     * @param {number} start Wartość początkowa
     * @param {number} end Wartość końcowa
     * @returns {Promise} Promise kończący się po zakończeniu animacji
     */
    animate(element, start, end) {
        return new Promise(resolve => {
            const startTime = performance.now();
            let currentFrame;

            // Dodaj klasę animacji
            element.classList.add('count-update');

            const updateValue = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / this.duration, 1);
                
                // Oblicz aktualną wartość używając funkcji easing
                const current = start + (end - start) * this.easing(progress);
                
                // Zaktualizuj element
                element.textContent = this.formatValue(current);
                
                // Wywołaj callback aktualizacji
                this.onUpdate(current, progress);

                if (progress < 1) {
                    // Kontynuuj animację
                    currentFrame = requestAnimationFrame(updateValue);
                } else {
                    // Zakończ animację
                    element.classList.remove('count-update');
                    resolve();
                }
            };

            // Rozpocznij animację
            currentFrame = requestAnimationFrame(updateValue);

            // Cleanup w przypadku przerwania
            return () => {
                if (currentFrame) {
                    cancelAnimationFrame(currentFrame);
                }
                element.classList.remove('count-update');
            };
        });
    }

    /**
     * Funkcja easing dla płynniejszej animacji
     * @param {number} x Postęp animacji (0-1)
     * @returns {number} Wartość po zastosowaniu funkcji easing
     */
    easeOutExpo(x) {
        return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    }

    /**
     * Formatuje liczbę jako string z separatorem tysięcy
     * @param {number} value Wartość do sformatowania
     * @returns {string} Sformatowana wartość
     */
    static formatWithCommas(value) {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Tworzy nową instancję z domyślnymi opcjami
     * @param {Object} options Opcje konfiguracyjne
     * @returns {Counter} Nowa instancja komponentu
     */
    static create(options = {}) {
        return new Counter(options);
    }
}

// Eksportuj domyślną instancję
export const counter = new Counter(); 