export class ReplayUploader {
    constructor() {
        this.modal = document.getElementById('uploadModal');
        this.uploadButton = document.getElementById('uploadWrButton');
        this.cancelButton = document.getElementById('cancelUpload');
        this.submitButton = document.getElementById('submitReplayUrl');
        this.urlInput = document.getElementById('replayUrlInput');
        this.errorMessage = null;
        this.isSubmitting = false;

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
    }

    hideModal() {
        this.modal.style.display = 'none';
        this.urlInput.value = '';
        this.clearError();
        this.setSubmitting(false);
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

    validateUrl(url) {
        const validPrefix = 'https://tagpro.koalabeast.com/game?replay';
        if (!url.startsWith(validPrefix)) {
            throw new Error('URLs should start with https://tagpro.koalabeast.com/game?replay...');
        }
        return true;
    }

    async extractUuid(url) {
        try {
            console.log('Attempting to fetch URL:', url);
            
            // First try direct fetch
            let response;
            try {
                response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Accept': 'text/html',
                        'Origin': window.location.origin
                    },
                    credentials: 'omit'
                });
            } catch (fetchError) {
                console.log('Direct fetch failed, trying with proxy...');
                // If direct fetch fails, try using a CORS proxy
                const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
                response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html',
                        'Origin': window.location.origin
                    }
                });
            }

            console.log('Fetch response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch replay page: ${response.status} ${response.statusText}`);
            }

            const html = await response.text();
            console.log('Received HTML length:', html.length);
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const replayLink = doc.getElementById('replayLink');

            if (!replayLink) {
                throw new Error('Could not find replay link on page');
            }

            const href = replayLink.getAttribute('href');
            console.log('Found replay link href:', href);
            
            const uuid = href.split('uuid=')[1];
            
            if (!uuid) {
                throw new Error('Could not extract UUID from replay link');
            }

            console.log('Successfully extracted UUID:', uuid);
            return uuid;
        } catch (error) {
            console.error('Detailed error in extractUuid:', error);
            throw new Error(`Error processing replay: ${error.message}`);
        }
    }

    async handleSubmit() {
        if (this.isSubmitting) return;
        
        const url = this.urlInput.value.trim();
        if (!url) return;

        try {
            this.setSubmitting(true);
            this.validateUrl(url);
            const uuid = await this.extractUuid(url);
            
            // TODO: Send the UUID to your backend
            console.log('Extracted UUID:', uuid);
            
            // Show success message
            this.showError('Replay submitted successfully!');
            setTimeout(() => {
                this.hideModal();
            }, 1500);
        } catch (error) {
            this.showError(error.message);
            this.setSubmitting(false);
        }
    }
} 