export class DebugPanel {
    constructor() {
        this.panel = document.querySelector('.debug-panel');
        this.header = this.panel.querySelector('.debug-header');
        this.isDragging = false;
        this.currentX = 0;
        this.currentY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.xOffset = 0;
        this.yOffset = 0;

        this.initialize();
    }

    initialize() {
        // Obsługa przeciągania
        this.header.addEventListener('mousedown', this.dragStart.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.dragEnd.bind(this));

        // Przywróć ostatnią pozycję
        const position = localStorage.getItem('debug-panel-position');
        if (position) {
            const { x, y } = JSON.parse(position);
            this.setPosition(x, y);
        }

        // Obsługa resize
        window.addEventListener('resize', () => {
            this.keepInViewport();
        });
    }

    dragStart(e) {
        this.isDragging = true;
        this.initialX = e.clientX - this.xOffset;
        this.initialY = e.clientY - this.yOffset;
    }

    drag(e) {
        if (!this.isDragging) return;

        e.preventDefault();
        this.currentX = e.clientX - this.initialX;
        this.currentY = e.clientY - this.initialY;

        this.xOffset = this.currentX;
        this.yOffset = this.currentY;

        this.setPosition(this.currentX, this.currentY);
    }

    dragEnd() {
        this.isDragging = false;
        this.keepInViewport();
        
        // Zapisz pozycję
        localStorage.setItem('debug-panel-position', JSON.stringify({
            x: this.xOffset,
            y: this.yOffset
        }));
    }

    setPosition(x, y) {
        this.panel.style.transform = `translate(${x}px, ${y}px)`;
    }

    keepInViewport() {
        const rect = this.panel.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        if (rect.right > viewport.width) {
            this.xOffset -= rect.right - viewport.width + 20;
        }
        if (rect.bottom > viewport.height) {
            this.yOffset -= rect.bottom - viewport.height + 20;
        }
        if (rect.left < 0) {
            this.xOffset -= rect.left - 20;
        }
        if (rect.top < 0) {
            this.yOffset -= rect.top - 20;
        }

        this.setPosition(this.xOffset, this.yOffset);
    }
} 