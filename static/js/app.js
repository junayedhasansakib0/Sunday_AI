/**
 * Sunday AI Web Dashboard — Client Logic & Neural Link Manager
 * Real-time WebSocket bridge, Biometric/Quick Auth, Web Speech API Voice Engine, and Telemetry.
 */

class SundayApp {
    constructor() {
        this.socket = null;
        this.reconnectInterval = 3000;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.isVoiceListening = false;
        this.speechRecognition = null;
        this.isAuthenticated = false;
        this.registeredUsers = [];

        // DOM Elements
        this.dom = {
            // Status Pills
            wsPill: document.getElementById('ws-pill'),
            wsStatusDot: document.getElementById('ws-status-dot'),
            wsStatusText: document.getElementById('ws-status-text'),
            cameraStatus: document.getElementById('camera-status-badge'),
            micStatus: document.getElementById('mic-status-badge'),
            aiStatus: document.getElementById('ai-status-badge'),
            memoryStatus: document.getElementById('memory-status-badge'),

            // Security Panel
            authBadge: document.getElementById('auth-status-badge'),
            userName: document.getElementById('user-name-display'),
            sessionDuration: document.getElementById('session-duration'),
            uptimeDisplay: document.getElementById('uptime-display'),
            telemetryAiEngine: document.getElementById('telemetry-ai-engine'),
            telemetryOs: document.getElementById('telemetry-os'),
            memoryPreviewList: document.getElementById('memory-preview-list'),

            // Command / Chat Area
            chatContainer: document.getElementById('chat-container'),
            commandInput: document.getElementById('command-input'),
            commandForm: document.getElementById('command-form'),
            sendBtn: document.getElementById('send-btn'),
            voiceBtn: document.getElementById('voice-btn'),
            chipButtons: document.querySelectorAll('.chip-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            refreshBtn: document.getElementById('refresh-btn'),

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
            registerNameInput: document.getElementById('register-name-input'),
            quickProfilesContainer: document.getElementById('quick-profiles-container'),
            quickProfilesList: document.getElementById('quick-profiles-list')
        };

        this.startTime = Date.now();
        this.init();
    }

    init() {
        this.setupSpeechRecognition();
        this.connectWebSocket();
        this.bindEvents();
        this.fetchSystemStatus();
        this.startUptimeTracker();

        // Initial welcome message
        this.appendMessage('assistant', 'Sunday AI Neural Core online. Authenticate via Face Recognition or select a profile to unlock command execution.');
    }

    /* -------------------------------------------------------------------------- */
    /* WEBSOCKET MANAGEMENT                                                       */
    /* -------------------------------------------------------------------------- */
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        console.log(`[Sunday Neural Link] Connecting to ${wsUrl}...`);
        try {
            this.socket = new WebSocket(wsUrl);
        } catch (err) {
            console.error('[Sunday Neural Link] Could not instantiate WebSocket:', err);
            this.updateConnectionStatus(false);
            return;
        }

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
                if (this.dom.wsPill) this.dom.wsPill.className = 'status-pill online';
            } else {
                this.dom.wsStatusDot.classList.remove('online');
                this.dom.wsStatusText.textContent = 'RECONNECTING';
                if (this.dom.wsPill) this.dom.wsPill.className = 'status-pill standby';
            }
        }
    }

    handleWebSocketEvent(msg) {
        const { event, data } = msg;

        switch (event) {
            case 'connection_established':
                if (data.authenticated !== undefined) {
                    this.updateAuthUI(data.authenticated, data.current_user);
                }
                break;

            case 'command_executed':
                if (data && data.response) {
                    this.appendMessage('assistant', data.response);
                }
                break;

            case 'auth_status_change':
                if (data) {
                    this.updateAuthUI(data.authenticated, data.user);
                    this.fetchSystemStatus();
                }
                break;

            case 'camera_status_change':
                if (this.dom.cameraStatus && data) {
                    this.dom.cameraStatus.textContent = data.status || 'STANDBY';
                    const parentPill = this.dom.cameraStatus.closest('.status-pill');
                    if (parentPill) {
                        parentPill.className = `status-pill ${data.status === 'ACTIVE' ? 'online' : 'standby'}`;
                    }
                }
                break;

            case 'register_success':
                if (data && data.name) {
                    this.setAuthAlert(`Registration successful for "${data.name}"!`, 'success', false);
                    this.appendMessage('assistant', `Face dataset saved for user "${data.name}". Database encodings reloaded.`);
                    setTimeout(() => {
                        this.dom.authRegisterView.style.display = 'none';
                        this.dom.authOptionsView.style.display = 'flex';
                        if (this.dom.registerNameInput) this.dom.registerNameInput.value = '';
                        this.fetchSystemStatus();
                    }, 1500);
                }
                break;

            case 'error':
                if (data && data.detail) {
                    this.appendMessage('assistant', `[Security Alert] ${data.detail}`);
                }
                break;

            default:
                console.log('[WebSocket Event]', event, data);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* SPEECH RECOGNITION (WEB SPEECH API)                                        */
    /* -------------------------------------------------------------------------- */
    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.log('[Voice Engine] Web Speech API not supported in this browser.');
            return;
        }

        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-US';

        this.speechRecognition.onstart = () => {
            this.isVoiceListening = true;
            if (this.dom.voiceBtn) this.dom.voiceBtn.classList.add('active');
            if (this.dom.micStatus) {
                this.dom.micStatus.textContent = 'LISTENING';
                const pill = this.dom.micStatus.closest('.status-pill');
                if (pill) pill.className = 'status-pill online';
            }
            if (this.dom.commandInput) {
                this.dom.commandInput.placeholder = 'Listening... Speak now';
            }
        };

        this.speechRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            if (this.dom.commandInput) {
                this.dom.commandInput.value = transcript;
            }
        };

        this.speechRecognition.onerror = (event) => {
            console.warn('[Voice Engine] Error:', event.error);
            this.stopVoiceInput();
        };

        this.speechRecognition.onend = () => {
            this.stopVoiceInput();
            const text = this.dom.commandInput ? this.dom.commandInput.value.trim() : '';
            if (text) {
                this.handleSendCommand();
            }
        };
    }

    toggleVoiceInput() {
        if (!this.speechRecognition) {
            this.appendMessage('assistant', '[Voice Engine] Browser Web Speech API is not supported in this browser. Please use Chrome/Edge or type your command.');
            return;
        }

        if (this.isVoiceListening) {
            try { this.speechRecognition.stop(); } catch (e) {}
            this.stopVoiceInput();
        } else {
            try {
                this.speechRecognition.start();
            } catch (e) {
                console.error('[Voice Engine] Could not start speech recognition:', e);
                this.stopVoiceInput();
            }
        }
    }

    stopVoiceInput() {
        this.isVoiceListening = false;
        if (this.dom.voiceBtn) this.dom.voiceBtn.classList.remove('active');
        if (this.dom.micStatus) {
            this.dom.micStatus.textContent = 'STANDBY';
            const pill = this.dom.micStatus.closest('.status-pill');
            if (pill) pill.className = 'status-pill standby';
        }
        if (this.dom.commandInput) {
            this.dom.commandInput.placeholder = this.isAuthenticated
                ? "Ask Sunday or run a desktop command..."
                : "Console locked. Authenticate via Face Recognition...";
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

        // ---------------- AUTH MODAL HANDLERS ---------------- //
        
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
                if (this.dom.registerNameInput) {
                    this.dom.registerNameInput.focus();
                }
                this.setAuthAlert('Enter profile name and click Start Capture.', 'info');
            });
        }

        // Cancel Register (Back to Options)
        if (this.dom.btnCancelRegister) {
            this.dom.btnCancelRegister.addEventListener('click', () => {
                this.dom.authRegisterView.style.display = 'none';
                this.dom.authOptionsView.style.display = 'flex';
                this.setAuthAlert('Select an authentication option to proceed:', 'info');
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
                this.hideAuthModal();
                this.setAuthAlert('Sunday AI is in secured standby mode.', 'info');
                this.appendMessage('assistant', '[System Notice] Dashboard is in standby mode. Commands are locked until verified.');
            });
        }
    }

    /* -------------------------------------------------------------------------- */
    /* AUTHENTICATION WORKFLOWS                                                   */
    /* -------------------------------------------------------------------------- */
    async triggerFaceLogin() {
        this.setAuthAlert('Camera active. Scanning for authorized face... (Look at camera or press Q in window to cancel)', 'scanning', true);
        if (this.dom.btnFaceLogin) this.dom.btnFaceLogin.disabled = true;

        try {
            const res = await fetch('/api/auth/face-login', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                this.setAuthAlert(`ACCESS GRANTED: Welcome, ${data.user}!`, 'success', false);
                this.appendMessage('assistant', `ACCESS GRANTED: Biometric authentication verified for ${data.user}. Sunday command console unlocked.`);
                
                setTimeout(() => {
                    this.updateAuthUI(true, data.user);
                }, 600);
            } else {
                this.setAuthAlert(data.message || data.detail || 'Face verification cancelled or unrecognized.', 'error', false);
            }
        } catch (err) {
            this.setAuthAlert(`Connection error: ${err.message}`, 'error', false);
        } finally {
            if (this.dom.btnFaceLogin) this.dom.btnFaceLogin.disabled = false;
        }
    }

    async triggerFaceRegistration() {
        const username = this.dom.registerNameInput ? this.dom.registerNameInput.value.trim() : '';
        if (!username) {
            this.setAuthAlert('Please enter a valid profile name.', 'error');
            return;
        }

        this.setAuthAlert(`Starting camera registration for "${username}". Look at camera and press SPACE on camera window to capture 5 photos.`, 'scanning', true);
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
                this.appendMessage('assistant', `Face profile registered for "${username}". Encodings updated in memory.`);
                
                setTimeout(() => {
                    this.dom.authRegisterView.style.display = 'none';
                    this.dom.authOptionsView.style.display = 'flex';
                    if (this.dom.registerNameInput) this.dom.registerNameInput.value = '';
                    this.fetchSystemStatus();
                }, 1200);
            } else {
                this.setAuthAlert(data.message || data.detail || 'Face registration was cancelled or failed.', 'error', false);
            }
        } catch (err) {
            this.setAuthAlert(`Registration error: ${err.message}`, 'error', false);
        } finally {
            if (this.dom.btnStartRegister) this.dom.btnStartRegister.disabled = false;
        }
    }

    async triggerQuickLogin(username) {
        if (!username) return;
        this.setAuthAlert(`Authenticating as "${username}"...`, 'scanning', true);

        try {
            const res = await fetch('/api/auth/quick-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: username })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                this.setAuthAlert(`ACCESS GRANTED: Welcome, ${username}!`, 'success', false);
                this.appendMessage('assistant', `ACCESS GRANTED: Session unlocked for profile "${username}".`);
                setTimeout(() => {
                    this.updateAuthUI(true, username);
                }, 400);
            } else {
                this.setAuthAlert(data.detail || 'Quick authentication failed.', 'error', false);
            }
        } catch (err) {
            this.setAuthAlert(`Login error: ${err.message}`, 'error', false);
        }
    }

    async performLogout() {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                this.updateAuthUI(false, null);
                this.appendMessage('assistant', 'Session locked. Please authenticate to continue.');
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
            this.dom.authOverlay.style.display = 'flex';
        }
        if (reasonText) {
            this.setAuthAlert(reasonText, 'error', false);
        }
    }

    hideAuthModal() {
        if (this.dom.authOverlay) {
            this.dom.authOverlay.classList.add('hidden');
            this.dom.authOverlay.style.display = 'none';
        }
    }

    updateAuthUI(authenticated, username) {
        this.isAuthenticated = !!(authenticated && username);

        if (this.isAuthenticated) {
            this.hideAuthModal();
            if (this.dom.authBadge) {
                this.dom.authBadge.className = 'auth-status-badge granted';
                this.dom.authBadge.innerHTML = '● ACCESS GRANTED';
            }
            if (this.dom.userName) {
                this.dom.userName.textContent = username;
            }
            if (this.dom.sessionDuration) {
                this.dom.sessionDuration.textContent = 'Unlocked';
            }

            // Enable command form
            if (this.dom.commandForm) this.dom.commandForm.classList.remove('disabled');
            if (this.dom.commandInput) {
                this.dom.commandInput.placeholder = `Command Sunday (e.g. 'open chrome', 'time', 'help', or ask anything)...`;
            }
        } else {
            this.showAuthModal();
            if (this.dom.authBadge) {
                this.dom.authBadge.className = 'auth-status-badge locked';
                this.dom.authBadge.innerHTML = '● LOCKED / STANDBY';
            }
            if (this.dom.userName) {
                this.dom.userName.textContent = 'Awaiting Authentication';
            }
            if (this.dom.sessionDuration) {
                this.dom.sessionDuration.textContent = 'Protected';
            }

            // Disable command form
            if (this.dom.commandForm) this.dom.commandForm.classList.add('disabled');
            if (this.dom.commandInput) {
                this.dom.commandInput.placeholder = 'Console locked. Authenticate via Face Recognition or select profile...';
            }
        }
    }

    /* -------------------------------------------------------------------------- */
    /* COMMAND EXECUTION                                                          */
    /* -------------------------------------------------------------------------- */
    async handleSendCommand() {
        const text = this.dom.commandInput ? this.dom.commandInput.value.trim() : '';
        if (!text) return;

        if (!this.isAuthenticated) {
            this.showAuthModal("Authentication required before transmitting commands.");
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
                // If websocket is offline or hasn't handled it, append directly
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
                this.appendMessage('assistant', `[Access Notice] ${data.detail || data.message || 'Execution rejected.'}`);
            }
        } catch (err) {
            this.appendMessage('assistant', `[Network Error] Unable to reach Sunday core: ${err.message}`);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* SYSTEM STATUS & TELEMETRY                                                  */
    /* -------------------------------------------------------------------------- */
    async fetchSystemStatus() {
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                this.updateAuthUI(data.authenticated, data.current_user);

                if (data.modules) {
                    if (this.dom.aiStatus) this.dom.aiStatus.textContent = data.modules.ai_brain;
                    if (this.dom.telemetryAiEngine) {
                        this.dom.telemetryAiEngine.textContent = data.modules.ai_model || 'Gemini Flash';
                    }
                }

                if (data.system && this.dom.telemetryOs) {
                    this.dom.telemetryOs.textContent = `${data.system.os || 'Windows'} ${data.system.machine || ''}`.trim();
                }

                if (data.users && Array.isArray(data.users)) {
                    this.registeredUsers = data.users;
                    this.renderRegisteredProfiles(data.users);
                }
            }
        } catch (err) {
            console.warn('[Status Fetch] Could not poll system status:', err);
        }
    }

    renderRegisteredProfiles(users) {
        // Update Memory Store panel on right sidebar
        if (this.dom.memoryPreviewList) {
            if (users.length === 0) {
                this.dom.memoryPreviewList.innerHTML = `
                    <article class="memory-item">
                        <div class="memory-item-icon">--</div>
                        <div>
                            <div class="memory-item-title">No Profiles</div>
                            <p>Use Option 2 to register a face.</p>
                        </div>
                        <span class="memory-type">INFO</span>
                    </article>
                `;
            } else {
                this.dom.memoryPreviewList.innerHTML = users.map(user => `
                    <article class="memory-item" style="cursor: pointer;" title="Click to quickly select ${user}" onclick="window.sunday.triggerQuickLogin('${user}')">
                        <div class="memory-item-icon">${user.slice(0, 2).toUpperCase()}</div>
                        <div>
                            <div class="memory-item-title">Authorized Profile</div>
                            <p>${user}</p>
                        </div>
                        <span class="memory-type">FACE ID</span>
                    </article>
                `).join('');
            }
        }

        // Update Quick Profile Selection inside Auth Modal
        if (this.dom.quickProfilesContainer && this.dom.quickProfilesList) {
            if (users.length > 0) {
                this.dom.quickProfilesContainer.style.display = 'block';
                this.dom.quickProfilesList.innerHTML = users.map(user => `
                    <button type="button" class="quick-profile-btn" onclick="window.sunday.triggerQuickLogin('${user}')">
                        <span class="quick-avatar">${user.slice(0, 2).toUpperCase()}</span>
                        <span class="quick-name">${user}</span>
                        <span class="quick-action">Select ›</span>
                    </button>
                `).join('');
            } else {
                this.dom.quickProfilesContainer.style.display = 'none';
            }
        }
    }

    appendMessage(sender, text) {
        if (!this.dom.chatContainer) return;

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
        if (text.includes('\n') && (text.includes(':') || text.includes('-') || text.includes('Operating System') || text.includes('Available System Commands'))) {
            return `<pre>${this.escapeHtml(text)}</pre>`;
        }
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    escapeHtml(str) {
        return String(str)
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
