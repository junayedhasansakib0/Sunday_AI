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
        self.model = model or os.getenv("AI_MODEL", "gemini-3.5-flash-lite")
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

        # Candidates in priority order
        candidates = [self.model, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-flash-latest"]
        models_to_try = []
        for m in candidates:
            if m and m not in models_to_try:
                models_to_try.append(m)

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
                "maxOutputTokens": 800
            }
        }

        last_error = None
        for model_name in models_to_try:
            clean_model = model_name.replace("models/", "")
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
                f"?key={self.api_key}"
            )

            try:
                response = self.session.post(url, json=payload, timeout=8)

                if response.status_code == 200:
                    data = response.json()
                    candidates_resp = data.get("candidates", [])
                    if candidates_resp:
                        parts = candidates_resp[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"].strip()
                    return "I received an empty response from the AI model."

                error_data = response.json().get("error", {})
                last_error = error_data.get("message", response.text)

            except requests.exceptions.Timeout:
                last_error = "AI request timed out. Please try again."
            except requests.exceptions.RequestException as e:
                last_error = f"Network error: {e}"
            except Exception as e:
                last_error = f"An error occurred: {e}"

        return f"[AI Response Notice] {last_error}" if last_error else "AI service currently unavailable."
