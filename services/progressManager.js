import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class ProgressManager extends BaseManager {
    constructor() {
        super();
        this.progressBar = null;
        this.progressText = null;
        this.progressContainer = null;
    }

    async initialize() {
        try {
            // Create progress elements if they don't exist
            this.ensureProgressElements();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initialize'
            });
            return false;
        }
    }

    ensureProgressElements() {
        // Check if container exists
        let container = document.querySelector('.progress-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'progress-container d-none';
            document.body.appendChild(container);
        }
        this.progressContainer = container;

        // Check if progress bar exists
        let progressBar = container.querySelector('.progress-bar');
        if (!progressBar) {
            const progressWrapper = document.createElement('div');
            progressWrapper.className = 'progress';
            progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.setAttribute('role', 'progressbar');
            progressBar.setAttribute('aria-valuenow', '0');
            progressBar.setAttribute('aria-valuemin', '0');
            progressBar.setAttribute('aria-valuemax', '100');
            progressWrapper.appendChild(progressBar);
            container.appendChild(progressWrapper);
        }
        this.progressBar = progressBar;

        // Check if progress text exists
        let progressText = container.querySelector('.progress-text');
        if (!progressText) {
            progressText = document.createElement('div');
            progressText.className = 'progress-text';
            container.appendChild(progressText);
        }
        this.progressText = progressText;
    }

    show(status = '') {
        if (this.progressContainer) {
            this.progressContainer.classList.remove('d-none');
            if (status) {
                this.setStatus(status);
            }
        }
    }

    hide() {
        if (this.progressContainer) {
            this.progressContainer.classList.add('d-none');
            this.setProgress(0);
            this.setStatus('');
        }
    }

    setStatus(status) {
        if (this.progressText) {
            this.progressText.textContent = status;
        }
    }

    setProgress(percentage, status = null) {
        if (this.progressBar) {
            const value = Math.min(100, Math.max(0, percentage));
            this.progressBar.style.width = `${value}%`;
            this.progressBar.setAttribute('aria-valuenow', value);
            
            if (status !== null) {
                this.setStatus(status);
            }
        }
    }

    startTask(taskName, totalSteps) {
        try {
            this.currentTask = {
                name: taskName,
                total: totalSteps,
                current: 0
            };
            this.show(taskName);
            this.setProgress(0);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'startTask',
                taskName,
                totalSteps
            });
        }
    }

    updateTask(increment = 1, status = '') {
        try {
            if (!this.currentTask) return;

            this.currentTask.current += increment;
            const progress = (this.currentTask.current / this.currentTask.total) * 100;
            
            this.setProgress(progress, status || this.currentTask.name);

            if (this.currentTask.current >= this.currentTask.total) {
                this.currentTask = null;
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateTask',
                increment,
                status
            });
        }
    }

    setError(message) {
        try {
            if (this.progressBar) {
                this.progressBar.classList.remove('bg-success', 'bg-warning');
                this.progressBar.classList.add('bg-danger');
                this.setStatus(message);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'setError',
                message
            });
        }
    }

    setSuccess(message) {
        try {
            if (this.progressBar) {
                this.progressBar.classList.remove('bg-danger', 'bg-warning');
                this.progressBar.classList.add('bg-success');
                this.setStatus(message);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'setSuccess',
                message
            });
        }
    }

    setWarning(message) {
        try {
            if (this.progressBar) {
                this.progressBar.classList.remove('bg-success', 'bg-danger');
                this.progressBar.classList.add('bg-warning');
                this.setStatus(message);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'setWarning',
                message
            });
        }
    }

    dispose() {
        try {
            this.hide();
            this.currentTask = null;
            this.progressElement = null;
            this.statusElement = null;
            this.progressBar = null;
            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }
} 