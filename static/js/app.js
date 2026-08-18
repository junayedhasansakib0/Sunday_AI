/**
 * Sunday AI Web Dashboard — Client Logic & Neural Link Manager
 */

class SundayApp {
    constructor() {
        this.socket = null;
        this.reconnectInterval = 3000;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.isVoiceListening = false;
        this.isAuthenticated = false;

        // DOM Elements
        this.dom = {
            wsStatusDot: document.getElementById('ws-status-dot'),
            wsStatusText: document.getElementById('ws-status-text'),
            authBadge: document.getElementById('auth-status-badge'),
            userName: document.getElementById('user-name-display'),
            sessionDuration: document.getElementById('session-duration'),
            uptimeDisplay: document.getElementById('uptime-display'),
            chatContainer: document.getElementById('chat-container'),
            commandInput: document.getElementById('command-input'),
            commandForm: document.getElementById('command-form'),
            voiceBtn: document.getElementById('voice-btn'),
            chipButtons: document.querySelectorAll('.chip-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            refreshBtn: document.getElementById('refresh-btn'),
            cameraStatus: document.getElementById('camera-status-badge'),
            micStatus: document.getElementById('mic-status-badge'),
            aiStatus: document.getElementById('ai-status-badge'),
            memoryStatus: document.getElementById('memory-status-badge'),

            // Auth Gateway Elements
            authOverlay: document.getElementById('auth-modal-overlay'),
            authAlert: document.getElementById('auth-modal-alert'),
            authAlertText: document.getElementById('auth-alert-text'),
            authSpinner: document.getElementById('auth-spinner'),
            authOptionsView: document.getElementById('auth-options-view'),
            authRegisterView: document.getElementById('auth-register-view'),
            btnFaceLogin: document.getElementById('btn-opt-face-login'),
            btnRegisterFace: document.getElementById('btn-opt-register-face'),
            btnStandby: document.getElementById('btn-opt-standby'),
            btnStartRegister: document.getElementById('btn-start-registration'),
            btnCancelRegister: document.getElementById('btn-cancel-registration'),
            registerNameInput: document.getElementById('register-name-input')
        };

        this.startTime = Date.now();
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.bindEvents();
        this.fetchSystemStatus();
        this.startUptimeTracker();

        // Initial state
        this.appendMessage('assistant', 'Sunday AI Neural Core initialized. Authentication is required before transmitting commands.');
    }

    /* -------------------------------------------------------------------------- */
    /* WEBSOCKET MANAGEMENT                                                       */
    /* -------------------------------------------------------------------------- */
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        console.log(`[Sunday Neural Link] Connecting to ${wsUrl}...`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('[Sunday Neural Link] Connection established.');
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleWebSocketEvent(message);
            } catch (err) {
                console.error('[Sunday Neural Link] Failed to parse message:', err);
            }
        };

        this.socket.onclose = () => {
            console.warn('[Sunday Neural Link] Connection lost.');
            this.updateConnectionStatus(false);
            this.scheduleReconnect();
        };

        this.socket.onerror = (error) => {
            console.error('[Sunday Neural Link] Socket error:', error);
            this.socket.close();
        };
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connectWebSocket(), this.reconnectInterval);
        }
    }

    updateConnectionStatus(online) {
        if (this.dom.wsStatusDot && this.dom.wsStatusText) {
            if (online) {
                this.dom.wsStatusDot.classList.add('online');
                this.dom.wsStatusText.textContent = 'ONLINE';
            } else {
                this.dom.wsStatusDot.classList.remove('online');
                this.dom.wsStatusText.textContent = 'RECONNECTING';
            }
        }
    }

    handleWebSocketEvent(msg) {
        const { event, data } = msg;

        switch (event) {
            case 'connection_established':
                this.updateAuthUI(data.authenticated, data.current_user);
                break;

            case 'command_executed':
                if (data.command && data.response) {
                    this.appendMessage('assistant', data.response);
                }
                break;

            case 'auth_status_change':
                this.updateAuthUI(data.authenticated, data.user);
                break;

            case 'camera_status_change':
                if (this.dom.cameraStatus) {
                    this.dom.cameraStatus.textContent = data.status || 'STANDBY';
                }
                break;

            case 'error':
                if (data.detail) {
                    this.appendMessage('assistant', `[Security Alert] ${data.detail}`);
                }
                break;

            default:
                console.log('[WebSocket Event]', event, data);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* EVENT BINDINGS                                                             */
    /* -------------------------------------------------------------------------- */
    bindEvents() {
        // Submit command form
        if (this.dom.commandForm) {
            this.dom.commandForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSendCommand();
            });
        }

        // Quick chip shortcuts
        this.dom.chipButtons.forEach((chip) => {
            chip.addEventListener('click', () => {
                if (!this.isAuthenticated) {
                    this.showAuthModal("Authentication required to run commands.");
                    return;
                }
                const cmd = chip.getAttribute('data-cmd');
                if (cmd) {
                    this.dom.commandInput.value = cmd;
                    this.handleSendCommand();
                }
            });
        });

        // Voice button
        if (this.dom.voiceBtn) {
            this.dom.voiceBtn.addEventListener('click', () => {
                if (!this.isAuthenticated) {
                    this.showAuthModal("Authentication required to use voice.");
                    return;
                }
                this.toggleVoiceInput();
            });
        }

        // Lock session button
        if (this.dom.logoutBtn) {
            this.dom.logoutBtn.addEventListener('click', async () => {
                await this.performLogout();
            });
        }

        // Refresh status button
        if (this.dom.refreshBtn) {
            this.dom.refreshBtn.addEventListener('click', () => {
                this.fetchSystemStatus();
            });
        }

        // ---------------- AUTH MODAL 3-OPTION HANDLERS ---------------- //
        
        // Option 1: Face Login
        if (this.dom.btnFaceLogin) {
            this.dom.btnFaceLogin.addEventListener('click', () => {
                this.triggerFaceLogin();
            });
        }

        // Option 2: Register Face (Show Sub-view)
        if (this.dom.btnRegisterFace) {
            this.dom.btnRegisterFace.addEventListener('click', () => {
                this.dom.authOptionsView.style.display = 'none';
                this.dom.authRegisterView.style.display = 'flex';
                this.dom.registerNameInput.focus();
                this.setAuthAlert('Enter your name and press START CAPTURE.', 'info');
            });
        }

        // Cancel Register (Back to Options)
        if (this.dom.btnCancelRegister) {
            this.dom.btnCancelRegister.addEventListener('click', () => {
                this.dom.authRegisterView.style.display = 'none';
                this.dom.authOptionsView.style.display = 'flex';
                this.setAuthAlert('Select an option to proceed:', 'info');
            });
        }

        // Start Register Routine
        if (this.dom.btnStartRegister) {
            this.dom.btnStartRegister.addEventListener('click', () => {
                this.triggerFaceRegistration();
            });
        }

        // Option 3: Lock / Standby Mode
        if (this.dom.btnStandby) {
            this.dom.btnStandby.addEventListener('click', () => {
                this.setAuthAlert('Sunday AI is in secured standby mode.', 'info');
            });
        }
    }

    /* -------------------------------------------------------------------------- */
    /* AUTHENTICATION WORKFLOWS                                                   */
    /* -------------------------------------------------------------------------- */
    async triggerFaceLogin() {
        this.setAuthAlert('Camera active. Scanning for authorized face... (Press Q on camera window to cancel)', 'scanning', true);
        if (this.dom.btnFaceLogin) this.dom.btnFaceLogin.disabled = true;

        try {
            const res = await fetch('/api/auth/face-login', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                this.setAuthAlert(`ACCESS GRANTED: Welcome, ${data.user}!`, 'success', false);
                this.appendMessage('assistant', `ACCESS GRANTED: Biometric authentication verified for ${data.user}. Sunday command console unlocked.`);
                
                setTimeout(() => {
                    this.updateAuthUI(true, data.user);
                }, 700);
            } else {
                this.setAuthAlert(data.detail || data.message || 'Face verification cancelled or unrecognized.', 'error', false);
            }
        } catch (err) {
            this.setAuthAlert(`Connection error: ${err.message}`, 'error', false);
        } finally {
            if (this.dom.btnFaceLogin) this.dom.btnFaceLogin.disabled = false;
        }
    }

    async triggerFaceRegistration() {
        const username = this.dom.registerNameInput.value.trim();
        if (!username) {
            this.setAuthAlert('Please enter a valid username.', 'error');
            return;
        }

        this.setAuthAlert(`Starting camera registration for "${username}". Look at camera and press SPACE to capture 5 photos.`, 'scanning', true);
        if (this.dom.btnStartRegister) this.dom.btnStartRegister.disabled = true;

        try {
            const res = await fetch('/api/auth/register-face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: username })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                this.setAuthAlert(`Registration successful for "${username}"! You can now log in.`, 'success', false);
                this.appendMessage('assistant', `Face dataset saved for user "${username}". Database encodings reloaded.`);
                
                setTimeout(() => {
                    this.dom.authRegisterView.style.display = 'none';
                    this.dom.authOptionsView.style.display = 'flex';
                    this.dom.registerNameInput.value = '';
                }, 1500);
            } else {
                this.setAuthAlert(data.detail || data.message || 'Face registration was cancelled or failed.', 'error', false);
            }
        } catch (err) {
            this.setAuthAlert(`Registration error: ${err.message}`, 'error', false);
        } finally {
            if (this.dom.btnStartRegister) this.dom.btnStartRegister.disabled = false;
        }
    }

    async performLogout() {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                this.updateAuthUI(false, null);
                this.appendMessage('assistant', 'Session locked. Please authenticate using Face Recognition (Option 1).');
            }
        } catch (err) {
            console.error('Logout error:', err);
        }
    }

    setAuthAlert(text, type = 'info', showSpinner = false) {
        if (this.dom.authAlertText) this.dom.authAlertText.textContent = text;
        if (this.dom.authAlert) {
            this.dom.authAlert.className = `auth-alert ${type}`;
        }
        if (this.dom.authSpinner) {
            this.dom.authSpinner.style.display = showSpinner ? 'inline-block' : 'none';
        }
    }

    showAuthModal(reasonText) {
        if (this.dom.authOverlay) {
            this.dom.authOverlay.classList.remove('hidden');
        }
        if (reasonText) {
            this.setAuthAlert(reasonText, 'error', false);
        }
    }

    hideAuthModal() {
        if (this.dom.authOverlay) {
            this.dom.authOverlay.classList.add('hidden');
        }
    }

    updateAuthUI(authenticated, username) {
        this.isAuthenticated = !!(authenticated && username);

        if (this.isAuthenticated) {
            this.hideAuthModal();
            this.dom.authBadge.className = 'auth-status-badge granted';
            this.dom.authBadge.innerHTML = '● ACCESS GRANTED';
            this.dom.userName.textContent = username;

            // Enable command form
            if (this.dom.commandForm) this.dom.commandForm.classList.remove('disabled');
            if (this.dom.commandInput) this.dom.commandInput.placeholder = `Command Sunday (e.g. 'open chrome', 'time', or ask AI)...`;
        } else {
            this.showAuthModal();
            this.dom.authBadge.className = 'auth-status-badge locked';
            this.dom.authBadge.innerHTML = '● LOCKED / STANDBY';
            this.dom.userName.textContent = 'Awaiting Authentication';

            // Disable command form
            if (this.dom.commandForm) this.dom.commandForm.classList.add('disabled');
            if (this.dom.commandInput) this.dom.commandInput.placeholder = 'Console locked. Authenticate via Face Recognition (Option 1)...';
        }
    }

    /* -------------------------------------------------------------------------- */
    /* COMMAND EXECUTION                                                          */
    /* -------------------------------------------------------------------------- */
    async handleSendCommand() {
        const text = this.dom.commandInput.value.trim();
        if (!text) return;

        if (!this.isAuthenticated) {
            this.showAuthModal("Authentication required before sending commands.");
            return;
        }

        // Clear input immediately
        this.dom.commandInput.value = '';

        // Append user bubble to chat
        this.appendMessage('user', text);

        // Execute command
        await this.executeCommand(text);
    }

    async executeCommand(commandText) {
        try {
            const response = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: commandText })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                    this.appendMessage('assistant', data.response);
                }
                
                if (commandText.toLowerCase() === 'logout') {
                    this.updateAuthUI(false, null);
                }
            } else {
                if (response.status === 401) {
                    this.updateAuthUI(false, null);
                    this.showAuthModal("Session locked. Please authenticate.");
                }
                this.appendMessage('assistant', `[Access Warning] ${data.detail || 'Execution rejected.'}`);
            }
        } catch (err) {
            this.appendMessage('assistant', `[Network Error] Unable to reach Sunday core: ${err.message}`);
        }
    }

    async fetchSystemStatus() {
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                this.updateAuthUI(data.authenticated, data.current_user);
                
                if (data.modules) {
                    if (this.dom.aiStatus) this.dom.aiStatus.textContent = data.modules.ai_brain;
                }
            }
        } catch (err) {
            console.warn('[Status Fetch] Could not poll system status:', err);
        }
    }

    toggleVoiceInput() {
        this.isVoiceListening = !this.isVoiceListening;
        if (this.isVoiceListening) {
            this.dom.voiceBtn.classList.add('active');
            this.appendMessage('assistant', '[Voice Engine] Microphone listening activated (Voice interface is undergoing Phase 06/07 neural integration).');
        } else {
            this.dom.voiceBtn.classList.remove('active');
            this.appendMessage('assistant', '[Voice Engine] Microphone listening in standby.');
        }
    }

    appendMessage(sender, text) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${sender}`;

        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const senderLabel = sender === 'user' ? 'YOU' : 'SUNDAY AI';

        bubble.innerHTML = `
            <div class="message-meta">
                <span>${senderLabel}</span>
                <span>•</span>
                <span>${timeString}</span>
            </div>
            <div class="message-content">
                ${this.formatMessageContent(text)}
            </div>
        `;

        this.dom.chatContainer.appendChild(bubble);
        this.dom.chatContainer.scrollTop = this.dom.chatContainer.scrollHeight;
    }

    formatMessageContent(text) {
        if (!text) return '';
        if (text.includes('\n') && (text.includes(':') || text.includes('-') || text.includes('Operating System'))) {
            return `<pre>${this.escapeHtml(text)}</pre>`;
        }
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    startUptimeTracker() {
        setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            const mins = Math.floor(elapsedSeconds / 60);
            const secs = elapsedSeconds % 60;
            if (this.dom.uptimeDisplay) {
                this.dom.uptimeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
}

// Instantiate on load
document.addEventListener('DOMContentLoaded', () => {
    window.sunday = new SundayApp();
});
