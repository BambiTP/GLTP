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
            
            // Extract the replay ID from the URL
            const urlObj = new URL(url);
            const replayId = urlObj.searchParams.get('replay');
            console.log('Extracted replay ID:', replayId);
            
            if (!replayId) {
                throw new Error('Could not extract replay ID from URL');
            }

            // First, fetch the replay data to get the game ID
            const replayUrl = `https://tagpro.koalabeast.com/replays/${replayId}`;
            console.log('Fetching replay data from:', replayUrl);
            
            const response = await fetch(replayUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch replay data: ${response.status} ${response.statusText}`);
            }

            const replayData = await response.json();
            console.log('Received replay data:', replayData);

            const gameId = replayData.gameId;
            if (!gameId) {
                throw new Error('Could not find game ID in replay data');
            }

            console.log('Found game ID:', gameId);

            // Connect using Socket.IO
            return new Promise((resolve, reject) => {
                console.log('Connecting to Socket.IO with game ID:', gameId);
                const socket = io('https://tagpro.koalabeast.com', {
                    path: '/socket.io',
                    transports: ['websocket'],
                    query: {
                        gameId: gameId
                    }
                });

                socket.on('connect', () => {
                    console.log('Socket.IO connected');
                    // Join the game room
                    socket.emit('joinGame', { gameId: gameId });
                });

                // Listen for game info
                socket.on('gameInfo', (data) => {
                    console.log('Received gameInfo:', data);
                    if (data.uuid) {
                        console.log('Found UUID:', data.uuid);
                        socket.disconnect();
                        resolve(data.uuid);
                    }
                });

                // Listen for any other relevant events
                socket.on('gameData', (data) => {
                    console.log('Received gameData:', data);
                });

                socket.on('connect_error', (error) => {
                    console.error('Socket.IO connection error:', error);
                    socket.disconnect();
                    reject(new Error('Socket.IO connection failed'));
                });

                // Set a timeout in case we don't get a response
                setTimeout(() => {
                    socket.disconnect();
                    reject(new Error('Socket.IO timeout - no response received'));
                }, 10000);
            });
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