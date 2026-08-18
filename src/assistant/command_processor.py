from src.assistant.automation import Automation
from src.ai.brain import AIBrain


class CommandProcessor:

    def __init__(self, state=None, brain=None):
        self.state = state
        self.brain = brain or AIBrain()
        self.running = True

    def process(self, raw_input):

        if not raw_input or not raw_input.strip():
            return "Please enter a command."

        command = raw_input.lower().strip()

        # =========================
        # HELP
        # =========================

        if command == "help":

            return """
Available System Commands:

help          - Display this help menu
time          - Get current local time
date          - Get today's date
system info   - View OS & system specs

open chrome   - Launch Google Chrome
open vscode   - Launch Visual Studio Code
open calculator - Launch Calculator
open notepad  - Launch Notepad
open youtube  - Open YouTube in browser

google <query>  - Search Google
youtube <query> - Search YouTube

logout        - Lock session and return to main menu
exit          - Shut down Sunday AI

(Or ask ANY question / give any prompt to chat with Sunday AI Brain!)
"""

        # =========================
        # TIME
        # =========================

        if command == "time":

            return Automation.get_time()

        # =========================
        # DATE
        # =========================

        if command == "date":

            return Automation.get_date()

        # =========================
        # APPLICATIONS
        # =========================

        if command == "open chrome":

            return Automation.open_chrome()

        if command == "open vscode":

            return Automation.open_vscode()

        if command == "open calculator":

            return Automation.open_calculator()

        if command == "open notepad":

            return Automation.open_notepad()

        # =========================
        # WEBSITES
        # =========================

        if command == "open youtube":

            return Automation.open_youtube()

        # =========================
        # GOOGLE SEARCH
        # =========================

        if command.startswith("google "):

            query = command[7:].strip()

            return Automation.google_search(query)

        # =========================
        # YOUTUBE SEARCH
        # =========================

        if command.startswith("youtube "):

            query = command[8:].strip()

            return Automation.youtube_search(query)

        # =========================
        # SYSTEM INFO
        # =========================

        if command == "system info":

            return Automation.system_info()

        # =========================
        # LOGOUT
        # =========================

        if command == "logout":

            if self.state:
                self.state.logout()
            self.running = False

            return "Session locked. Logging out..."

        # =========================
        # EXIT
        # =========================

        if command == "exit":

            if self.state:
                self.state.stop()
            self.running = False

            return "Shutting down Sunday..."

        # =========================
        # AI BRAIN (FALLBACK)
        # =========================
        # Forward unhandled / natural language queries to Gemini AI Brain
        return self.brain.ask(raw_input.strip())

    def is_running(self):

        return self.running