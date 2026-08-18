"""
Sunday AI — Voice Controller Module (Phase 06)

Manages the threaded voice input loop that runs alongside the text
console after face authentication. Captures speech via VoiceListener,
normalizes it via VoiceNormalizer, and routes the result through the
existing CommandProcessor.

This module does NOT duplicate any command logic — it is purely an
input adapter that feeds voice into the same pipeline as text commands.
"""

import threading
import time

from src.assistant.voice.listener import VoiceListener
from src.assistant.voice.normalizer import VoiceNormalizer


class VoiceController:
    """
    Threaded voice input controller for Sunday AI.

    Runs a background daemon thread that continuously listens for
    voice commands and routes them through CommandProcessor.
    Voice processing only occurs while the user is authenticated.
    """

    def __init__(self, state, command_processor):
        """
        Args:
            state: AssistantState instance (thread-safe).
            command_processor: CommandProcessor instance to route commands to.
        """
        self.state = state
        self.command_processor = command_processor
        self.listener = VoiceListener()
        self.normalizer = VoiceNormalizer()

        self._stop_event = threading.Event()
        self._thread = None

    def start(self):
        """
        Starts the voice listening loop in a daemon thread.
        Safe to call multiple times — will not spawn duplicate threads.
        """
        if self._thread is not None and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._voice_loop,
            name="SundayAI-VoiceController",
            daemon=True,
        )
        self._thread.start()
        print("[VOICE] Voice control activated. You can speak commands now.")

    def stop(self):
        """
        Signals the voice loop to stop and waits for the thread to finish.
        """
        self._stop_event.set()

        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=3.0)

        self._thread = None
        print("[VOICE] Voice control deactivated.")

    @property
    def is_active(self) -> bool:
        """Returns True if the voice thread is currently running."""
        return self._thread is not None and self._thread.is_alive()

    def _voice_loop(self):
        """
        Main voice processing loop. Runs in a background thread.

        Flow per iteration:
            1. Check authentication gate
            2. Listen for speech (blocking, with timeout)
            3. Normalize the transcribed text
            4. Route through CommandProcessor
            5. Print Sunday's response
        """
        while not self._stop_event.is_set():

            # ── Authentication Gate ──────────────────────────────
            if not self.state.is_authenticated:
                # Session was locked/logged out — stop the voice loop
                print("[VOICE] Session no longer authenticated. Stopping voice control.")
                break

            # ── Listen ───────────────────────────────────────────
            raw_text = self.listener.listen_once()

            # Check stop signal again after the blocking listen call
            if self._stop_event.is_set():
                break

            if raw_text is None:
                # Timeout or unintelligible — silently retry
                continue

            print(f"\n[VOICE] Heard: \"{raw_text}\"")

            # ── Normalize ────────────────────────────────────────
            normalized = self.normalizer.normalize(raw_text)

            if not normalized:
                continue

            print(f"[VOICE] Command: \"{normalized}\"")

            # ── Route through CommandProcessor ───────────────────
            try:
                response = self.command_processor.process(normalized)
                print(f"Sunday: {response}\n")
            except Exception as e:
                print(f"[VOICE] Error processing command: {e}")

            # ── Handle session-ending commands ───────────────────
            if normalized in ("logout", "exit"):
                self._stop_event.set()
                break

            # Small delay to prevent CPU spinning between utterances
            time.sleep(0.3)
