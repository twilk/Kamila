import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

/**
 * @extends {BaseManager}
 * Manages progress indicators and loading states for ongoing operations
 */
export class OperationProgressManager extends BaseManager {
    static #instance = null;
    #progressBar = null;
    #progressText = null;
    #progressContainer = null;
    #currentTask = null;
    #isVisible = false;
    #hideTimeout = null;
    #progress = 0;
    #total = 0;
    #text = '';

    static getInstance() {
        if (!OperationProgressManager.#instance) {
            OperationProgressManager.#instance = new OperationProgressManager();
        }
        return OperationProgressManager.#instance;
    }

    constructor() {
        super('OperationProgressManager');
        if (OperationProgressManager.#instance) {
            throw new Error('Use OperationProgressManager.getInstance()');
        }
    }

    async onInitialize() {
        try {
            this.#ensureProgressElements();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    #ensureProgressElements() {
        try {
            // Check if container exists
            let container = document.querySelector('.operation-progress-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'operation-progress-container hidden';
                document.body.appendChild(container);
            }
            this.#progressContainer = container;

            // Check if progress bar exists
            let progressBar = container.querySelector('.operation-progress-bar');
            if (!progressBar) {
                const progressWrapper = document.createElement('div');
                progressWrapper.className = 'operation-progress';
                progressBar = document.createElement('div');
                progressBar.className = 'operation-progress-bar';
                progressBar.setAttribute('role', 'progressbar');
                progressBar.setAttribute('aria-valuenow', '0');
                progressBar.setAttribute('aria-valuemin', '0');
                progressBar.setAttribute('aria-valuemax', '100');
                progressWrapper.appendChild(progressBar);
                container.appendChild(progressWrapper);
            }
            this.#progressBar = progressBar;

            // Check if progress text exists
            let progressText = container.querySelector('.operation-progress-text');
            if (!progressText) {
                progressText = document.createElement('div');
                progressText.className = 'operation-progress-text';
                container.appendChild(progressText);
            }
            this.#progressText = progressText;

            this.log(LogLevel.SUCCESS, '✅ Progress elements initialized');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.HIGH, {
                method: 'ensureProgressElements'
            });
        }
    }

    show(status = '') {
        try {
            if (this.#hideTimeout) {
                clearTimeout(this.#hideTimeout);
                this.#hideTimeout = null;
            }
            if (this.#progressContainer) {
                this.#progressContainer.classList.remove('hidden');
                if (status) {
                    this.setStatus(status);
                }
            }
            this.#isVisible = true;
            this.log(LogLevel.DEBUG, '🔄 Progress bar shown', { status });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'show',
                status
            });
        }
    }

    hide() {
        try {
            if (this.#progressContainer) {
                this.#progressContainer.classList.add('hidden');
                this.setProgress(0);
                this.setStatus('');
            }
            this.#isVisible = false;
            this.#currentTask = null;
            this.#hideTimeout = null;
            this.log(LogLevel.DEBUG, '🔄 Progress bar hidden');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'hide'
            });
        }
    }

    setStatus(status) {
        try {
            if (this.#progressText) {
                this.#progressText.textContent = status;
                this.log(LogLevel.DEBUG, '📝 Progress status updated', { status });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'setStatus',
                status
            });
        }
    }

    setProgress(percentage, status = null) {
        try {
            if (this.#progressBar) {
                const value = Math.min(100, Math.max(0, percentage));
                this.#progressBar.style.width = `${value}%`;
                this.#progressBar.setAttribute('aria-valuenow', value);
                
                if (status !== null) {
                    this.setStatus(status);
                }

                this.log(LogLevel.DEBUG, '📊 Progress updated', { percentage: value, status });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'setProgress',
                percentage,
                status
            });
        }
    }

    startTask(taskName, totalSteps) {
        try {
            this.#currentTask = {
                name: taskName,
                total: totalSteps,
                current: 0
            };
            this.show(taskName);
            this.setProgress(0);
            this.log(LogLevel.INFO, '🎬 Task started', { taskName, totalSteps });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'startTask',
                taskName,
                totalSteps
            });
        }
    }

    updateTask(increment = 1, status = '') {
        try {
            if (!this.#currentTask) return;

            this.#currentTask.current += increment;
            const progress = (this.#currentTask.current / this.#currentTask.total) * 100;
            
            this.setProgress(progress, status || this.#currentTask.name);

            this.log(LogLevel.DEBUG, '🔄 Task updated', {
                taskName: this.#currentTask.name,
                current: this.#currentTask.current,
                total: this.#currentTask.total,
                progress
            });

            if (this.#currentTask.current >= this.#currentTask.total) {
                this.#currentTask = null;
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'updateTask',
                increment,
                status
            });
        }
    }

    setError(message) {
        try {
            if (this.#progressBar) {
                this.#progressBar.classList.remove('bg-success', 'bg-warning');
                this.#progressBar.classList.add('bg-danger');
                this.setStatus(message);
                this.log(LogLevel.ERROR, '❌ Progress error', { message });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'setError',
                message
            });
        }
    }

    setSuccess(message) {
        try {
            if (this.#progressBar) {
                this.#progressBar.classList.remove('bg-danger', 'bg-warning');
                this.#progressBar.classList.add('bg-success');
                this.setStatus(message);
                this.log(LogLevel.SUCCESS, '✅ Progress success', { message });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'setSuccess',
                message
            });
        }
    }

    setWarning(message) {
        try {
            if (this.#progressBar) {
                this.#progressBar.classList.remove('bg-success', 'bg-danger');
                this.#progressBar.classList.add('bg-warning');
                this.setStatus(message);
                this.log(LogLevel.WARNING, '⚠️ Progress warning', { message });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'setWarning',
                message
            });
        }
    }

    async dispose() {
        try {
            this.hide();
            this.#currentTask = null;
            this.#progressBar = null;
            this.#progressText = null;
            this.#progressContainer = null;
            await super.dispose();
            this.log(LogLevel.INFO, '🧹 Progress manager disposed');
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }
}

// Export singleton instance
export const progressManager = OperationProgressManager.getInstance(); 