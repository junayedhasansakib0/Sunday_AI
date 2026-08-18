"""
Sunday AI — Voice Listener Module (Phase 06)

Low-level microphone capture and speech-to-text conversion using
Google's free STT engine via the SpeechRecognition library.

This module handles ONLY audio capture and transcription.
It does NOT interpret, normalize, or execute any commands.
"""

import speech_recognition as sr


class VoiceListener:
    """
    Captures a single utterance from the default microphone and
    returns the recognized text using Google Speech-to-Text.
    """

    def __init__(self, timeout: float = 5.0, phrase_time_limit: float = 10.0):
        """
        Args:
            timeout: Max seconds to wait for speech to begin before giving up.
            phrase_time_limit: Max seconds of speech to capture per utterance.
        """
        self.recognizer = sr.Recognizer()
        self.timeout = timeout
        self.phrase_time_limit = phrase_time_limit

        # Tuning: raise energy threshold to reduce ambient noise false positives
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 1.0

    def listen_once(self) -> str | None:
        """
        Captures one utterance from the microphone and returns the
        recognized text as a lowercase string.

        Returns:
            Recognized text (str) on success, or None on any failure.
            All errors are printed to console — never raised.
        """
        try:
            with sr.Microphone() as source:
                # Brief ambient noise calibration on first call
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)

                audio = self.recognizer.listen(
                    source,
                    timeout=self.timeout,
                    phrase_time_limit=self.phrase_time_limit,
                )

            # Transcribe via Google's free STT API
            text = self.recognizer.recognize_google(audio)

            if text and text.strip():
                return text.strip()

            return None

        except sr.WaitTimeoutError:
            # No speech detected within the timeout window — normal, not an error
            return None

        except sr.UnknownValueError:
            print("[VOICE] Could not understand the audio. Please try again.")
            return None

        except sr.RequestError as e:
            print(f"[VOICE] Speech recognition API error: {e}")
            return None

        except OSError as e:
            print(f"[VOICE] Microphone error: {e}")
            print("[VOICE] Please check that a microphone is connected and accessible.")
            return None

        except Exception as e:
            print(f"[VOICE] Unexpected error during listening: {e}")
            return None
