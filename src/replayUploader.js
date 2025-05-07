import { parseReplayFromURL, updateUI } from './replayParser.js';

// creates the UI for the upload WR replay button, and 
class ReplayUploader {
    constructor() {
        this.modal = document.getElementById('uploadModal');
        this.uploadButton = document.getElementById('uploadWrButton');
        this.cancelButton = document.getElementById('cancelUpload');
        this.submitButton = document.getElementById('submitReplayUrl');
        this.urlInput = document.getElementById('replayUrlInput');
        this.errorMessage = null;
        this.isSubmitting = false;
        this.resultsContainer = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Show modal
        this.uploadButton.addEventListener('click', () => {
            this.showModal();
        });

        // Cancel button
        this.cancelButton.addEventListener('click', () => {
            if (!this.isSubmitting) {
                this.hideModal();
            }
        });

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === this.modal && !this.isSubmitting) {
                this.hideModal();
            }
        });

        // Handle form submission
        this.submitButton.addEventListener('click', () => {
            this.handleSubmit();
        });

        // Handle Enter key in input
        this.urlInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !this.isSubmitting) {
                this.handleSubmit();
            }
        });
    }

    showModal() {
        this.modal.style.display = 'block';
        this.urlInput.focus();
        this.clearError();
        this.setSubmitting(false);
        
        // Keep results hidden when showing modal
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'none';
        }
    }

    hideModal() {
        this.modal.style.display = 'none';
        this.urlInput.value = '';
        this.clearError();
        this.setSubmitting(false);
        
        // Hide results when closing modal
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'none';
        }
    }

    showError(message) {
        this.clearError();
        this.errorMessage = document.createElement('div');
        this.errorMessage.className = 'error-message';
        this.errorMessage.textContent = message;
        this.urlInput.parentElement.insertBefore(this.errorMessage, this.urlInput.nextSibling);
    }

    clearError() {
        if (this.errorMessage) {
            this.errorMessage.remove();
            this.errorMessage = null;
        }
    }

    // Disable the submit button and the input field when submitting
    setSubmitting(isSubmitting) {
        this.isSubmitting = isSubmitting;
        this.submitButton.disabled = isSubmitting;
        this.cancelButton.disabled = isSubmitting;
        this.urlInput.disabled = isSubmitting;
        
        if (isSubmitting) {
            this.submitButton.textContent = 'Submitting...';
            this.submitButton.classList.add('submitting');
        } else {
            this.submitButton.textContent = 'Submit';
            this.submitButton.classList.remove('submitting');
        }
    }

    // Validate the URL has the correct prefix
    validateUrl(url) {
        const validPrefix = 'https://tagpro.koalabeast.com/game?replay';
        if (!url.startsWith(validPrefix)) {
            throw new Error('URLs should start with https://tagpro.koalabeast.com/game?replay...');
            // URL looks like this: https://tagpro.koalabeast.com/game?replay=aBqgmEYJ6LRbiauGZTv8/iW0XY1d3tCp 
        }
        return true;
    }

    async loadReplayResults() {
        try {
            // Use a path that will work both locally and on GitHub Pages
            const basePath = window.location.hostname === 'localhost' ? '' : '/GLTP';
            const response = await fetch(`${basePath}/html/replay_results.html`);
            const html = await response.text();
            return html;
        } catch (error) {
            console.error('Error loading replay results component:', error);
            return null;
        }
    }

    async displayReplayResults(parsedData) {
        // Load and insert the replay results HTML if not already present
        if (!this.resultsContainer) {
            const replayResults = await this.loadReplayResults();
            if (replayResults) {
                // Insert after the form, but keep the form visible
                const modalForm = this.modal.querySelector('.modal-form');
                modalForm.insertAdjacentHTML('afterend', replayResults);
                this.resultsContainer = document.getElementById('results');
            }
        }

        // Show the results container and update UI with parsed data
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'block';
            updateUI(parsedData);
        }
        
        // Reset submitting state after displaying results
        this.setSubmitting(false);
    }

    async handleSubmit() {
        if (this.isSubmitting) return;
        
        const url = this.urlInput.value.trim();
        if (!url) return;

        try {
            this.setSubmitting(true);
            this.validateUrl(url);
            
            // First get the parsed data
            const parsedData = await parseReplayFromURL(url);
            console.log('Parsed data:', parsedData);
            
            // Then display the results with the parsed data
            await this.displayReplayResults(parsedData);
            
            // TODO: Send the UUID to your backend
            
            // Show success message in the results area instead of the modal
            if (this.resultsContainer) {
                const successMessage = document.createElement('div');
                successMessage.className = 'success-message';
                successMessage.textContent = 'Replay submitted successfully!';
                this.resultsContainer.insertBefore(successMessage, this.resultsContainer.firstChild);
                
                // Remove success message after a delay
                setTimeout(() => {
                    successMessage.remove();
                }, 3000);
            }
        } catch (error) {
            this.showError(error.message);
            this.setSubmitting(false);
        }
    }
} 

export { ReplayUploader };