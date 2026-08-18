import os
import requests
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()


class AIBrain:
    """
    AI Brain interface powered by Google AI Studio (Gemini).
    Provides conversational responses when user input does not match
    predefined system automation commands.
    """

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("AI_MODEL", "gemini-3.6-flash")
        self.session = requests.Session()
        self.system_prompt = (
            "You are Sunday, a smart, polite, and helpful desktop AI personal assistant. "
            "Respond directly, concisely, and naturally. Avoid overly verbose explanations unless asked."
        )

    def ask(self, prompt: str) -> str:
        """
        Sends a user prompt to the Gemini API and returns Sunday's response.
        """
        if not prompt or not prompt.strip():
            return "How can I help you today?"

        if not self.api_key:
            return (
                "[AI Brain Offline] No Google AI Studio API key found. "
                "Please configure GEMINI_API_KEY in your .env file."
            )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
            f"?key={self.api_key}"
        )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt.strip()}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": self.system_prompt}]
            },
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 1000
            }
        }

        # Try up to 2 times in case of transient network hiccups
        for attempt in range(2):
            try:
                response = self.session.post(url, json=payload, timeout=25)

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"].strip()
                    return "I received an empty response from the AI model."

                error_data = response.json().get("error", {})
                error_msg = error_data.get("message", response.text)
                return f"[AI Error] ({response.status_code}): {error_msg}"

            except requests.exceptions.Timeout:
                if attempt == 0:
                    continue
                return "[AI Error] Request timed out. Please check your network connection."

            except requests.exceptions.RequestException as e:
                if attempt == 0:
                    continue
                return f"[AI Error] Network error: {e}"

            except Exception as e:
                return f"[AI Error] An unexpected error occurred: {e}"

        return "[AI Error] Unable to reach Gemini API after retrying."
