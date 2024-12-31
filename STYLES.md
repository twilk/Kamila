# Organizacja Styli w DARWINA.PL Assistant

## Struktura Plików

```
├── style.css                 # Główny plik ze zmiennymi i podstawowymi stylami
└── styles/
    ├── animations.css        # Animacje i przejścia
    ├── hud.css              # Style dla HUD (Head-Up Display)
    ├── styles.css           # Style formularzy i kontrolek
    └── theme.css            # Style dla motywów (jasny/ciemny)
```

## Kolejność Importów

W `popup.html` pliki CSS są importowane w następującej kolejności:

```html
<link rel="stylesheet" href="lib/bootstrap.min.css">     <!-- Framework Bootstrap -->
<link rel="stylesheet" href="style.css">                 <!-- Zmienne i podstawowe style -->
<link rel="stylesheet" href="styles/theme.css">          <!-- Style motywów -->
<link rel="stylesheet" href="styles/animations.css">     <!-- Animacje -->
<link rel="stylesheet" href="styles/hud.css">           <!-- HUD -->
<link rel="stylesheet" href="styles/styles.css">         <!-- Formularze -->
```

## Zawartość Plików

### style.css
- Zmienne CSS (kolory, wymiary, cienie)
- Podstawowe style layoutu
- Style dla głównych kontenerów
- Style dla tabów i paneli

### styles/theme.css
- Style dla jasnego motywu
- Style dla ciemnego motywu
- Kolory i tła specyficzne dla motywów
- Przejścia między motywami

### styles/animations.css
- Animacje dla loaderów
- Efekty przejść
- Animacje dla liczników
- Animacje dla przycisków
- Skeleton loading

### styles/hud.css
- Style dla performance HUD
- Animacje HUD
- Responsywność HUD
- Style dla trybu wysokiego kontrastu

### styles/styles.css
- Style dla formularzy
- Style dla inputów
- Style dla selectów
- Style dla przycisków
- Walidacja formularzy
- Stany disabled
- Focus states

## Zmienne CSS

### Kolory
```css
--wine-primary: #722F37;     /* Bordowy jak wino */
--wine-secondary: #A4343A;   /* Ciemniejszy czerwony */
--wine-accent: #D4AF37;      /* Złoty akcent */
```

### Motywy
```css
--bg-primary: var(--gray-100);
--bg-secondary: var(--gray-200);
--text-primary: var(--gray-900);
--text-secondary: var(--gray-600);
```

### Wymiary
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
```

## Konwencje Nazewnictwa

### Klasy
- `.btn-*` - przyciski
- `.form-*` - elementy formularzy
- `.lead-*` - elementy związane z leadami
- `.*-primary` - główne warianty
- `.*-secondary` - drugorzędne warianty

### Moduły
- Każdy moduł ma swój prefiks (np. `hud-*`, `debug-*`)
- Modyfikatory używają dwóch myślników (np. `btn--large`)
- Stany używają pojedynczego myślnika (np. `btn-disabled`)

## Responsywność

### Breakpointy
```css
@media (max-width: 768px) { /* Tablet */ }
@media (max-width: 576px) { /* Mobile */ }
```

### HUD Responsywność
```css
@media (max-width: 768px) {
    .performance-hud {
        width: 200px;
        height: 133px;
    }
}
```

## Best Practices

1. **Modularność**
   - Każdy plik CSS ma swoją konkretną odpowiedzialność
   - Unikamy powtarzania styli
   - Wykorzystujemy zmienne CSS

2. **Wydajność**
   - Minimalizujemy zagnieżdżanie selektorów
   - Używamy efektywnych selektorów
   - Optymalizujemy animacje (transform, opacity)

3. **Maintenance**
   - Komentujemy sekcje kodu
   - Grupujemy powiązane style
   - Zachowujemy spójną strukturę plików

4. **Dostępność**
   - Odpowiednie kontrasty kolorów
   - Wsparcie dla trybu wysokiego kontrastu
   - Focus states dla nawigacji klawiaturą 