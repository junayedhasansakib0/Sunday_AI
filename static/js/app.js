/**
 * Sunday AI Web Dashboard — Client Logic & In-Browser Neural Link Manager
 * Real-time In-Browser WebRTC Camera Face Verification & Registration,
 * Web Speech API Voice Engine, WebSocket Sync, and Telemetry.
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

        // Camera stream state
        this.mediaStream = null;
        this.cameraMode = null; // 'login' | 'register'
        this.cameraScanningTimer = null;
        this.isVerifyingFrame = false;
        this.registerName = null;
        this.registerShotCount = 0;

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
            quickProfilesList: document.getElementById('quick-profiles-list'),

            // In-Browser Camera Elements
            authCameraView: document.getElementById('auth-camera-view'),
            webcamVideo: document.getElementById('webcam-video'),
            webcamOverlay: document.getElementById('webcam-overlay'),
            webcamSnapshot: document.getElementById('webcam-snapshot'),
            scannerLaser: document.getElementById('scanner-laser'),
            cameraStatusPill: document.getElementById('camera-status-pill'),
            cameraStatusPillText: document.getElementById('camera-status-pill-text'),
            btnStopCamera: document.getElementById('btn-stop-camera'),
            cameraRegControls: document.getElementById('camera-reg-controls'),
            btnTakeSnapshot: document.getElementById('btn-take-snapshot'),
            currentShotNum: document.getElementById('current-shot-num')
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
        this.appendMessage('assistant', 'Sunday AI Neural Core online. Verify via Face ID or select a profile to unlock command execution.');
    }

    /* -------------------------------------------------------------------------- */
    /* WEBSOCKET MANAGEMENT                                                       */
    /* -------------------------------------------------------------------------- */
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        try {
            this.socket = new WebSocket(wsUrl);
        } catch (err) {
            console.error('[Sunday Neural Link] WebSocket creation failed:', err);
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

            case 'register_success':
                if (data && data.name) {
                    this.setAuthAlert(`Registration successful for "${data.name}"!`, 'success', false);
                    this.appendMessage('assistant', `Face dataset saved for user "${data.name}". Database encodings reloaded.`);
                    this.fetchSystemStatus();
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
    /* IN-BROWSER WEBCAM AUTHENTICATION & REGISTRATION                            */
    /* -------------------------------------------------------------------------- */
    async startBrowserCamera(mode = 'login', targetName = null) {
        this.cameraMode = mode;
        this.registerName = targetName;
        this.registerShotCount = 0;

        // Switch modal sub-views
        if (this.dom.authOptionsView) this.dom.authOptionsView.style.display = 'none';
        if (this.dom.authRegisterView) this.dom.authRegisterView.style.display = 'none';
        if (this.dom.authCameraView) this.dom.authCameraView.style.display = 'flex';

        if (mode === 'login') {
            this.setAuthAlert('Webcam active. Scanning for authorized face...', 'scanning', true);
            if (this.dom.cameraRegControls) this.dom.cameraRegControls.style.display = 'none';
            if (this.dom.scannerLaser) this.dom.scannerLaser.style.display = 'block';
            if (this.dom.cameraStatusPillText) this.dom.cameraStatusPillText.textContent = 'FACE ID SCANNER';
        } else {
            this.setAuthAlert(`Profile "${targetName}": Look at camera and click "Capture Shot" (5 required).`, 'info', false);
            if (this.dom.cameraRegControls) this.dom.cameraRegControls.style.display = 'flex';
            if (this.dom.scannerLaser) this.dom.scannerLaser.style.display = 'none';
            if (this.dom.cameraStatusPillText) this.dom.cameraStatusPillText.textContent = `REGISTERING: ${targetName.toUpperCase()}`;
            this.resetCaptureDots();
        }

        // Update Top HUD Camera badge
        if (this.dom.cameraStatus) {
            this.dom.cameraStatus.textContent = 'ACTIVE';
            const pill = this.dom.cameraStatus.closest('.status-pill');
            if (pill) pill.className = 'status-pill online';
        }

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });

            if (this.dom.webcamVideo) {
                this.dom.webcamVideo.srcObject = this.mediaStream;
                await this.dom.webcamVideo.play();
            }

            if (mode === 'login') {
                this.startFaceScanLoop();
            }
        } catch (err) {
            console.error('[Webcam Error]', err);
            this.setAuthAlert(`Could not access webcam: ${err.message}. Please allow camera permissions.`, 'error', false);
            this.stopBrowserCamera();
        }
    }

    stopBrowserCamera() {
        if (this.cameraScanningTimer) {
            clearInterval(this.cameraScanningTimer);
            this.cameraScanningTimer = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.dom.webcamVideo) {
            this.dom.webcamVideo.srcObject = null;
        }

        this.clearOverlayCanvas();

        // Reset HUD Camera badge
        if (this.dom.cameraStatus) {
            this.dom.cameraStatus.textContent = 'STANDBY';
            const pill = this.dom.cameraStatus.closest('.status-pill');
            if (pill) pill.className = 'status-pill standby';
        }

        if (this.dom.authCameraView) this.dom.authCameraView.style.display = 'none';
        if (this.dom.authOptionsView) this.dom.authOptionsView.style.display = 'flex';
        this.cameraMode = null;
    }

    startFaceScanLoop() {
        if (this.cameraScanningTimer) clearInterval(this.cameraScanningTimer);

        // Snapshot and send frame every 450ms
        this.cameraScanningTimer = setInterval(async () => {
            if (this.isVerifyingFrame || this.cameraMode !== 'login' || !this.mediaStream) return;

            const frameData = this.captureVideoFrameBase64();
            if (!frameData) return;

            this.isVerifyingFrame = true;
            try {
                const res = await fetch('/api/auth/verify-frame', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: frameData })
                });

                const data = await res.json();
                this.handleVerifyFrameResponse(data);
            } catch (err) {
                console.warn('[Frame Verify Error]', err);
            } finally {
                this.isVerifyingFrame = false;
            }
        }, 450);
    }

    captureVideoFrameBase64() {
        const video = this.dom.webcamVideo;
        const canvas = this.dom.webcamSnapshot;
        if (!video || !canvas || video.videoWidth === 0) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
    }

    handleVerifyFrameResponse(data) {
        if (!data) return;

        // Draw bounding boxes on overlay canvas
        this.drawFacesOnOverlay(data.faces || []);

        if (data.authenticated && data.user) {
            // Verification succeeded!
            if (this.cameraScanningTimer) {
                clearInterval(this.cameraScanningTimer);
                this.cameraScanningTimer = null;
            }

            if (this.dom.cameraStatusPill) this.dom.cameraStatusPill.classList.add('granted');
            if (this.dom.cameraStatusPillText) this.dom.cameraStatusPillText.textContent = `GRANTED: ${data.user.toUpperCase()}`;
            this.setAuthAlert(`ACCESS GRANTED: Welcome, ${data.user}!`, 'success', false);
            this.appendMessage('assistant', `ACCESS GRANTED: Biometric verification verified for ${data.user}. Console unlocked.`);

            setTimeout(() => {
                this.stopBrowserCamera();
                this.updateAuthUI(true, data.user);
            }, 700);
        } else if (data.face_detected) {
            this.setAuthAlert('Face detected. Verifying identity encodings...', 'scanning', true);
        } else {
            this.setAuthAlert('Camera active. Scanning for authorized face...', 'scanning', true);
        }
    }

    drawFacesOnOverlay(faces) {
        const video = this.dom.webcamVideo;
        const canvas = this.dom.webcamOverlay;
        if (!canvas || !video || video.videoWidth === 0) return;

        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        faces.forEach(face => {
            const { top, right, bottom, left } = face.box;
            // Mirror coordinates horizontally for mirrored video
            const boxWidth = (right - left) * scaleX;
            const boxHeight = (bottom - top) * scaleY;
            const boxX = canvas.width - (right * scaleX);
            const boxY = top * scaleY;

            ctx.lineWidth = 2.5;
            ctx.strokeStyle = face.authorized ? '#53e6a5' : '#ff4757';
            ctx.shadowColor = face.authorized ? 'rgba(83, 230, 165, 0.8)' : 'rgba(255, 71, 87, 0.8)';
            ctx.shadowBlur = 8;
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            // Label banner
            ctx.fillStyle = face.authorized ? '#53e6a5' : '#ff4757';
            ctx.fillRect(boxX, Math.max(0, boxY - 22), Math.max(boxWidth, 120), 22);

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#06080d';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(face.name.toUpperCase(), boxX + 6, Math.max(15, boxY - 6));
        });
    }

    clearOverlayCanvas() {
        const canvas = this.dom.webcamOverlay;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    resetCaptureDots() {
        for (let i = 1; i <= 5; i++) {
            const dot = document.getElementById(`dot-${i}`);
            if (dot) {
                dot.className = `capture-dot ${i === 1 ? 'active' : ''}`;
            }
        }
        if (this.dom.currentShotNum) this.dom.currentShotNum.textContent = '1';
    }

    async handleCaptureSnapshot() {
        if (this.cameraMode !== 'register' || !this.registerName || !this.mediaStream) return;

        const nextShot = this.registerShotCount + 1;
        if (nextShot > 5) return;

        const frameData = this.captureVideoFrameBase64();
        if (!frameData) {
            this.setAuthAlert('Could not capture frame from webcam.', 'error');
            return;
        }

        if (this.dom.btnTakeSnapshot) this.dom.btnTakeSnapshot.disabled = true;
        this.setAuthAlert(`Saving photo ${nextShot}/5 for "${this.registerName}"...`, 'scanning', true);

        try {
            const res = await fetch('/api/auth/register-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: this.registerName,
                    image: frameData,
                    shot_index: nextShot
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                this.registerShotCount = nextShot;
                const dot = document.getElementById(`dot-${nextShot}`);
                if (dot) dot.className = 'capture-dot captured';

                if (data.completed || this.registerShotCount >= 5) {
                    this.setAuthAlert(`Registration completed for "${this.registerName}"!`, 'success', false);
                    this.appendMessage('assistant', `Face dataset saved for user "${this.registerName}". Database encodings reloaded.`);
                    setTimeout(() => {
                        this.stopBrowserCamera();
                        this.fetchSystemStatus();
                    }, 1200);
                } else {
                    const nextDot = document.getElementById(`dot-${nextShot + 1}`);
                    if (nextDot) nextDot.className = 'capture-dot active';
                    if (this.dom.currentShotNum) this.dom.currentShotNum.textContent = `${nextShot + 1}`;
                    this.setAuthAlert(`Captured ${nextShot}/5. Click Capture Shot again (${nextShot + 1}/5).`, 'info', false);
                }
            } else {
                this.setAuthAlert(data.message || data.detail || 'Failed to save snapshot.', 'error', false);
            }
        } catch (err) {
            this.setAuthAlert(`Capture error: ${err.message}`, 'error', false);
        } finally {
            if (this.dom.btnTakeSnapshot) this.dom.btnTakeSnapshot.disabled = false;
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
                : "Console locked. Authenticate via Face ID...";
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
        
        // Option 1: Face Login (Start In-Browser Webcam)
        if (this.dom.btnFaceLogin) {
            this.dom.btnFaceLogin.addEventListener('click', () => {
                this.startBrowserCamera('login');
            });
        }

        // Option 2: Register Face (Show Name Input Sub-view)
        if (this.dom.btnRegisterFace) {
            this.dom.btnRegisterFace.addEventListener('click', () => {
                this.dom.authOptionsView.style.display = 'none';
                this.dom.authRegisterView.style.display = 'flex';
                if (this.dom.registerNameInput) {
                    this.dom.registerNameInput.focus();
                }
                this.setAuthAlert('Enter profile name and click "Open Camera & Capture".', 'info');
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

        // Start Camera for Registration
        if (this.dom.btnStartRegister) {
            this.dom.btnStartRegister.addEventListener('click', () => {
                const username = this.dom.registerNameInput ? this.dom.registerNameInput.value.trim() : '';
                if (!username) {
                    this.setAuthAlert('Please enter a profile name first.', 'error');
                    return;
                }
                this.startBrowserCamera('register', username);
            });
        }

        // Snapshot capture button for registration
        if (this.dom.btnTakeSnapshot) {
            this.dom.btnTakeSnapshot.addEventListener('click', () => {
                this.handleCaptureSnapshot();
            });
        }

        // Stop Camera button
        if (this.dom.btnStopCamera) {
            this.dom.btnStopCamera.addEventListener('click', () => {
                this.stopBrowserCamera();
                this.setAuthAlert('Authentication was cancelled.', 'info');
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
                this.dom.commandInput.placeholder = 'Console locked. Authenticate via Face ID or select profile...';
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
