import os
import subprocess
import webbrowser
import platform
from datetime import datetime


class Automation:

    @staticmethod
    def open_chrome():

        try:
            chrome_paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            ]

            for path in chrome_paths:

                if os.path.exists(path):

                    subprocess.Popen([path])
                    return "Opening Google Chrome."

            # Fallback
            webbrowser.open("https://www.google.com")

            return "Chrome executable not found. Opening Google instead."

        except Exception as error:

            return f"Could not open Chrome: {error}"

    @staticmethod
    def open_vscode():

        try:

            subprocess.Popen(
                ["code"],
                shell=True
            )

            return "Opening Visual Studio Code."

        except Exception as error:

            return f"Could not open VS Code: {error}"

    @staticmethod
    def open_calculator():

        try:

            if platform.system() == "Windows":

                subprocess.Popen(
                    ["calc.exe"]
                )

                return "Opening Calculator."

            return "Calculator is not configured for this operating system."

        except Exception as error:

            return f"Could not open Calculator: {error}"

    @staticmethod
    def open_notepad():

        try:

            if platform.system() == "Windows":

                subprocess.Popen(
                    ["notepad.exe"]
                )

                return "Opening Notepad."

            return "Notepad is not configured for this operating system."

        except Exception as error:

            return f"Could not open Notepad: {error}"

    @staticmethod
    def open_youtube():

        webbrowser.open(
            "https://www.youtube.com"
        )

        return "Opening YouTube."

    @staticmethod
    def google_search(query):

        if not query:

            return "Please provide something to search."

        url = (
            "https://www.google.com/search?q="
            + query.replace(" ", "+")
        )

        webbrowser.open(url)

        return f"Searching Google for: {query}"

    @staticmethod
    def youtube_search(query):

        if not query:

            return "Please provide something to search."

        url = (
            "https://www.youtube.com/results?search_query="
            + query.replace(" ", "+")
        )

        webbrowser.open(url)

        return f"Searching YouTube for: {query}"

    @staticmethod
    def get_time():

        current_time = datetime.now().strftime(
            "%I:%M:%S %p"
        )

        return f"The current time is {current_time}."

    @staticmethod
    def get_date():

        current_date = datetime.now().strftime(
            "%A, %d %B %Y"
        )

        return f"Today is {current_date}."

    @staticmethod
    def system_info():

        system = platform.system()
        release = platform.release()
        machine = platform.machine()

        return (
            f"Operating System: {system}\n"
            f"Version: {release}\n"
            f"Architecture: {machine}"
        )