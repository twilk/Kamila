/**
 * Konfiguracja progów optymalizacji wydajności
 */
export const OPTIMIZATION_THRESHOLDS = {
    performance: {
        // Progi wydajności animacji
        animation: {
            fps: {
                critical: 30,
                warning: 45,
                target: 60
            },
            frameTime: {
                critical: 33.33, // 30fps
                warning: 22.22, // 45fps
                target: 16.67  // 60fps
            },
            jank: {
                critical: 5,
                warning: 2,
                acceptable: 1
            }
        },
        
        // Progi dla score'u wydajności
        score: {
            critical: 60,
            warning: 75,
            target: 85
        }
    },

    optimization: {
        // Progi dla włączania optymalizacji
        triggers: {
            heavy: 70,  // Włącz ciężkie optymalizacje poniżej 70
            light: 85   // Włącz lekkie optymalizacje poniżej 85
        },
        
        // Minimalna poprawa wymagana do utrzymania optymalizacji
        minimumImpact: {
            fps: 5,        // 5% poprawy FPS
            frameTime: 10, // 10% redukcji czasu klatki
            jank: 20,     // 20% redukcji janku
            score: 5      // 5% poprawy ogólnego score'u
        }
    },

    monitoring: {
        // Częstotliwość sprawdzania metryk
        sampleRate: 100,  // ms
        
        // Wielkość okna próbkowania
        windowSize: 10,   // próbek
        
        // Próg dla alertów wydajnościowych
        alertThreshold: 3 // kolejne próbki poniżej progu
    }
}; 