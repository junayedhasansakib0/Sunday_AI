# 🌐 Sunday AI — Futuristic Desktop & Web AI Assistant

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8.svg?logo=opencv&logoColor=white)](https://opencv.org/)
[![WebSockets](https://img.shields.io/badge/WebSockets-Real--Time-success.svg)](https://websockets.readthedocs.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Sunday AI** is a modular, futuristic Jarvis-inspired AI personal assistant. It combines computer vision biometric authentication, conversational intelligence powered by Google Gemini, safe local computer automation, and a cyberpunk HUD web dashboard.

---

## ⚡ Vision & Architecture

```
                    Face Recognition
                           ↓
                     Authentication
                           ↓
                   Sunday AI Core
                           ↓
             ┌─────────────┴─────────────┐
             ↓                           ↓
    Voice + Text Commands            AI Brain (Gemini)
             ↓                           ↓
   Safe Computer Automation         Short/Long Memory
             ↓                           ↓
         Terminal Console       Web HUD Dashboard (WebSocket)
```

---

## 🚀 Current Development Status

| Phase | Component | Status | Description |
|---|---|---|---|
| **Phase 01** | Webcam Vision | ✅ Completed | OpenCV video stream with auto-power down |
| **Phase 02** | Face Detection | ✅ Completed | Haar Cascade bounding box detection |
| **Phase 03** | Face Recognition | ✅ Completed | 128-d face encodings with authorized profile matching |
| **Phase 04** | Authentication | ✅ Completed | Biometric lock/unlock with presence timeout manager |
| **Phase 05** | Commands & Automation | ✅ Completed | Safe whitelisted OS automation (apps, search, specs) |
| **Phase 06** | Voice Input | 🔨 In Progress | PyAudio & SpeechRecognition integration |
| **AI Brain** | Conversational Core | ✅ Completed | Gemini Flash fallback for natural language reasoning |
| **Web 01** | Web Dashboard | ✅ Completed | FastAPI server, WebSocket channel, and futuristic HUD |

---

## 🖥️ System Requirements & Tech Stack

- **Operating System:** Windows 10/11
- **Backend:** Python 3.10+, FastAPI, Uvicorn, WebSockets, Jinja2
- **AI & Vision:** Google Gemini API, OpenCV, Face Recognition (`dlib`), NumPy
- **Automation:** Python Subprocess, Webbrowser, Platform APIs
- **Frontend:** Modern Semantic HTML5, Vanilla CSS Glassmorphism HUD, Vanilla JavaScript (ES6+)

---

## 📦 Project Structure

```
AegisAI/
│
├── main.py                     # Terminal console & biometric login launcher
├── web_server.py               # Web dashboard server launcher (Uvicorn)
├── register_face.py            # CLI tool to register new authorized faces
├── requirements.txt            # Python dependencies
├── .env                        # Environment secrets (GEMINI_API_KEY)
├── .gitignore
│
├── data/
│   ├── faces/
│   │   └── authorized/         # Known face image datasets (e.g. Vantorix/)
│   └── database/               # SQLite memory & conversation storage (Upcoming)
│
├── src/
│   ├── authentication.py       # Authentication state manager
│   ├── face_recognition.py     # Face encoding and recognition pipeline
│   │
│   ├── assistant/
│   │   ├── automation.py       # Safe OS automation whitelist
│   │   ├── command_processor.py# Command routing & intent parser
│   │   ├── state.py            # Thread-safe session & presence state
│   │   └── voice/              # Microphone listener & speaker engine
│   │
│   ├── ai/
│   │   └── brain.py            # Google Gemini AI Brain interface
│   │
│   └── web/
│       ├── server.py           # FastAPI application factory
│       ├── websocket.py        # Real-time WebSocket connection manager
│       ├── routes/
│       │   ├── system.py       # /api/status, /api/system-info
│       │   ├── assistant.py    # /api/command
│       │   └── ws.py           # /ws WebSocket route
│       └── templates/
│           └── index.html      # Futuristic HUD template
│
└── static/
    ├── css/
    │   └── style.css           # Glassmorphism & Cyberpunk design system
    └── js/
        └── app.js              # Client-side neural link & WebSocket manager
```

---

## ⚙️ Installation & Setup

### 1. Clone & Set Up Virtual Environment
```bash
git clone <repo-url>
cd AegisAI

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (cmd/PowerShell):
.\venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure API Key
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_ai_studio_api_key_here
AI_MODEL=gemini-1.5-flash
SUNDAY_HOST=127.0.0.1
SUNDAY_PORT=8000
```

---

## 🎮 Usage Guide

### Option A: Launch Web HUD Dashboard (Recommended)
```bash
python web_server.py
```
- **Web Dashboard:** [http://localhost:8000](http://localhost:8000)
- **Interactive REST API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live WebSocket Link:** `ws://localhost:8000/ws`

### Option B: Launch Terminal Console
```bash
python main.py
```
Provides CLI face biometric authentication followed by interactive console commands.

### Register New Faces
```bash
python register_face.py
```
Captures reference photos via webcam and registers the profile into `data/faces/authorized/<username>/`.

---

## 🛡️ Supported Commands

| Command | Action |
|---|---|
| `help` | Display list of commands |
| `time` | Current local time |
| `date` | Current date |
| `system info` | Operating system, machine architecture & specs |
| `open chrome` | Launch Google Chrome |
| `open vscode` | Launch Visual Studio Code |
| `open calculator` | Launch Windows Calculator |
| `open notepad` | Launch Windows Notepad |
| `open youtube` | Open YouTube in default browser |
| `google <query>` | Search Google for query |
| `youtube <query>` | Search YouTube for query |
| `logout` | Lock active session |
| `exit` | Shut down Sunday |
| *`<any other prompt>`* | Direct conversational query routed to **Gemini AI Brain** |

---

## 🔮 Future Roadmap & Upgrade Hints

- [ ] **Web Phase 04 — Web Biometric Auth:** Stream webcam video directly from the browser (`getUserMedia`) to the backend for web-based face login.
- [ ] **Web Phase 07 — Voice Interface:** Live audio streaming from browser microphone to a modular speech recognition engine (Whisper / faster-whisper).
- [ ] **Web Phase 09 — SQLite Long-Term Memory:** Persistent user preferences, conversation logs, and recallable notes stored in `data/database/assistant.db`.
- [ ] **Proactive Presence Security:** Automatic camera lock when user walks away with customizable countdown timer.
- [ ] **Role-Based Access:** Multi-user permission tiers (Owner, Guest, Admin).
- [ ] **Progressive Web App (PWA) & Secure Remote Access:** Tailscale / Cloudflare tunnel pairing with local encryption.

---

## 🔒 Security Policy
Sunday AI executes local operating system operations. Arbitrary shell execution from AI responses is **strictly forbidden**. Every actionable intent passes through a strict validation whitelist before execution.
