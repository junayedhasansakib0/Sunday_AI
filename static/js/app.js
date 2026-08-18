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
            memoryStatus: document.getElementById('memory-status-badge')
        };

        this.startTime = Date.now();
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.bindEvents();
        this.fetchSystemStatus();
        this.startUptimeTracker();

        // Welcome greeting in chat
        this.appendMessage('assistant', 'Sunday AI Neural Core initialized. Ready for text commands or system queries. Type "help" to view capabilities.');
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
                if (data.authenticated) {
                    this.updateAuthUI(true, data.current_user);
                }
                break;

            case 'command_executed':
                // Check if this was broadcasted from another event
                // If it's already displayed locally, skip duplication
                if (data.command && data.response) {
                    this.appendMessage('assistant', data.response);
                }
                break;

            case 'auth_status_change':
                this.updateAuthUI(data.authenticated, data.user);
                break;

            default:
                console.log('[WebSocket Event]', event, data);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* REST API & EVENT BINDINGS                                                  */
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
                const cmd = chip.getAttribute('data-cmd');
                if (cmd) {
                    this.dom.commandInput.value = cmd;
                    this.handleSendCommand();
                }
            });
        });

        // Voice button (mock/interactive for phase 01)
        if (this.dom.voiceBtn) {
            this.dom.voiceBtn.addEventListener('click', () => {
                this.toggleVoiceInput();
            });
        }

        // Logout/Lock session button
        if (this.dom.logoutBtn) {
            this.dom.logoutBtn.addEventListener('click', () => {
                this.executeCommand('logout');
            });
        }

        // Refresh status button
        if (this.dom.refreshBtn) {
            this.dom.refreshBtn.addEventListener('click', () => {
                this.fetchSystemStatus();
            });
        }
    }

    async handleSendCommand() {
        const text = this.dom.commandInput.value.trim();
        if (!text) return;

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
                // If WS is not active, render assistant response manually
                if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                    this.appendMessage('assistant', data.response);
                }
                
                // If the command was logout, update UI
                if (commandText.toLowerCase() === 'logout') {
                    this.updateAuthUI(false, null);
                }
            } else {
                this.appendMessage('assistant', `[Error] ${data.detail || 'Execution failed.'}`);
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

    updateAuthUI(authenticated, username) {
        if (authenticated && username) {
            this.dom.authBadge.className = 'auth-status-badge granted';
            this.dom.authBadge.innerHTML = '● ACCESS GRANTED';
            this.dom.userName.textContent = username;
        } else {
            this.dom.authBadge.className = 'auth-status-badge locked';
            this.dom.authBadge.innerHTML = '● LOCKED / STANDBY';
            this.dom.userName.textContent = 'Awaiting Authentication';
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
        // If content looks like multiline command output or code block, wrap in pre
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
