export class ProgressManager {
    constructor() {
        this.container = document.querySelector('.progress-container');
        this.progressBar = document.getElementById('progress-bar');
        this.statusText = document.getElementById('progress-status');
        this.percentageText = document.getElementById('progress-percentage');
        this.currentTask = null;
        this.isVisible = false;
    }

    show(status = 'Ładowanie...') {
        this.container.classList.remove('hidden');
        this.setStatus(status);
        this.setProgress(0);
        this.isVisible = true;
    }

    hide() {
        this.container.classList.add('hidden');
        this.isVisible = false;
        this.currentTask = null;
    }

    setStatus(status) {
        this.statusText.textContent = status;
    }

    setProgress(percentage, status = null) {
        const progress = Math.min(Math.max(percentage, 0), 100);
        this.progressBar.style.width = `${progress}%`;
        this.progressBar.setAttribute('aria-valuenow', progress);
        this.percentageText.textContent = `${Math.round(progress)}%`;
        
        if (status) {
            this.setStatus(status);
        }

        if (progress === 100) {
            setTimeout(() => {
                if (this.isVisible) {
                    this.hide();
                }
            }, 1000);
        }
    }

    startTask(taskName, totalSteps) {
        this.currentTask = {
            name: taskName,
            total: totalSteps,
            current: 0
        };
        this.show(taskName);
    }

    updateTask(increment = 1, status = null) {
        if (!this.currentTask) return;

        this.currentTask.current += increment;
        const progress = (this.currentTask.current / this.currentTask.total) * 100;
        
        this.setProgress(
            progress,
            status || `${this.currentTask.name} (${this.currentTask.current}/${this.currentTask.total})`
        );
    }

    setError(message) {
        this.container.classList.add('error');
        this.setStatus(`Błąd: ${message}`);
        setTimeout(() => {
            this.hide();
            this.container.classList.remove('error');
        }, 3000);
    }

    setSuccess(message) {
        this.container.classList.add('success');
        this.setStatus(message);
        this.setProgress(100);
        setTimeout(() => {
            this.hide();
            this.container.classList.remove('success');
        }, 2000);
    }

    setWarning(message) {
        this.container.classList.add('warning');
        this.setStatus(message);
        setTimeout(() => {
            this.hide();
            this.container.classList.remove('warning');
        }, 3000);
    }
} 