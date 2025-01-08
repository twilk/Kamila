export class ProgressManager {
    static instance = null;

    constructor() {
        if (ProgressManager.instance) {
            return ProgressManager.instance;
        }
        
        this.container = document.querySelector('.progress-container');
        if (!this.container) {
            this.createProgressContainer();
        }
        this.progressBar = document.getElementById('progress-bar');
        this.statusText = document.getElementById('progress-status');
        this.percentageText = document.getElementById('progress-percentage');
        this.currentTask = null;
        this.isVisible = false;
        this.hideTimeout = null;

        ProgressManager.instance = this;
        console.log('ProgressManager initialized'); // Debug log
    }

    createProgressContainer() {
        const container = document.createElement('div');
        container.className = 'progress-container hidden';
        container.innerHTML = `
            <div class="progress-wrapper">
                <div class="progress">
                    <div id="progress-bar" class="progress-bar" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div id="progress-status" class="progress-status">Ładowanie...</div>
                <div id="progress-percentage" class="progress-percentage">0%</div>
            </div>
        `;
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) {
            sidePanel.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
        this.container = container;
        console.log('Progress container created'); // Debug log
    }

    show(status = 'Ładowanie...') {
        console.log('Showing progress with status:', status); // Debug log
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        this.container.classList.remove('hidden');
        this.setStatus(status);
        this.setProgress(0);
        this.isVisible = true;
    }

    hide() {
        console.log('Hiding progress'); // Debug log
        this.container.classList.add('hidden');
        this.isVisible = false;
        this.currentTask = null;
        this.hideTimeout = null;
    }

    setStatus(status) {
        console.log('Setting status:', status); // Debug log
        if (this.statusText) {
            this.statusText.textContent = status;
        }
    }

    setProgress(percentage, status = null) {
        console.log('Setting progress:', percentage, status); // Debug log
        const progress = Math.min(Math.max(percentage, 0), 100);
        
        if (this.progressBar) {
            this.progressBar.style.width = `${progress}%`;
            this.progressBar.setAttribute('aria-valuenow', progress);
        }
        
        if (this.percentageText) {
            this.percentageText.textContent = `${Math.round(progress)}%`;
        }
        
        if (status) {
            this.setStatus(status);
        }

        if (progress === 100) {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
            }
            this.hideTimeout = setTimeout(() => {
                if (this.isVisible) {
                    this.hide();
                }
            }, 1000);
        }
    }

    startTask(taskName, totalSteps) {
        console.log('Starting task:', taskName, totalSteps); // Debug log
        this.currentTask = {
            name: taskName,
            total: totalSteps,
            current: 0
        };
        this.show(taskName);
    }

    updateTask(increment = 1, status = null) {
        if (!this.currentTask) {
            console.log('No current task to update'); // Debug log
            return;
        }

        this.currentTask.current += increment;
        const progress = (this.currentTask.current / this.currentTask.total) * 100;
        
        console.log('Updating task:', {
            current: this.currentTask.current,
            total: this.currentTask.total,
            progress,
            status
        }); // Debug log

        this.setProgress(
            progress,
            status || `${this.currentTask.name} (${this.currentTask.current}/${this.currentTask.total})`
        );
    }

    setError(message) {
        console.log('Setting error:', message); // Debug log
        this.container.classList.add('error');
        this.setStatus(`Błąd: ${message}`);
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = setTimeout(() => {
            this.hide();
            this.container.classList.remove('error');
        }, 3000);
    }

    setSuccess(message) {
        console.log('Setting success:', message); // Debug log
        this.container.classList.add('success');
        this.setStatus(message);
        this.setProgress(100);
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = setTimeout(() => {
            this.hide();
            this.container.classList.remove('success');
        }, 2000);
    }

    setWarning(message) {
        console.log('Setting warning:', message); // Debug log
        this.container.classList.add('warning');
        this.setStatus(message);
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = setTimeout(() => {
            this.hide();
            this.container.classList.remove('warning');
        }, 3000);
    }
} 