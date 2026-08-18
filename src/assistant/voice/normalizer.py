"""
Sunday AI — Voice Normalizer Module (Phase 06)

Translates natural-language voice input into the exact command strings
expected by CommandProcessor. This is a pure translation layer — it
never executes commands or accesses any system resources.

Examples:
    "What time is it?"          → "time"
    "Open Google Chrome"        → "open chrome"
    "Search YouTube for cats"   → "youtube cats"
    "Hey, can you show me the system info?" → "system info"
"""

import re
from typing import Callable


class VoiceNormalizer:
    """
    Maps natural-language voice phrases to the canonical command
    strings expected by CommandProcessor.
    """

    def __init__(self):
        # Each rule is (compiled_regex_pattern, replacement_string_or_callable).
        # Rules are evaluated top-to-bottom; first match wins.
        # Groups in the regex can be referenced in the replacement.
        self._rules = self._build_rules()

    @staticmethod
    def _build_rules() -> list[tuple[re.Pattern, str | Callable]]:
        """
        Build and return the ordered list of normalization rules.
        Each rule is (pattern, replacement).

        If replacement is a string, re.sub is used.
        If replacement is a callable, it receives the Match object.
        """
        flags = re.IGNORECASE

        return [
            # ─── EXIT / QUIT ──────────────────────────────────────
            (re.compile(
                r"^(?:shut\s*down|quit|exit|close|terminate|stop)\s*(?:sunday|the\s+(?:app|program|system))?[.!?]*$",
                flags,
            ), "exit"),

            # ─── LOGOUT ──────────────────────────────────────────
            (re.compile(
                r"^(?:log\s*(?:me\s+)?out|lock\s+(?:the\s+)?session|sign\s*out)[.!?]*$",
                flags,
            ), "logout"),

            # ─── GOOGLE SEARCH ────────────────────────────────────
            # "Search Google for cats" / "Google search cats" / "Google cats"
            (re.compile(
                r"^(?:search\s+google\s+for|google\s+search(?:\s+for)?|google)\s+(.+)$",
                flags,
            ), "google {1}"),

            # ─── YOUTUBE SEARCH ───────────────────────────────────
            # "Search YouTube for cats" / "YouTube search cats"
            (re.compile(
                r"^(?:search\s+youtube\s+for|youtube\s+search(?:\s+for)?|find\s+(?:a\s+)?(?:video|videos)\s+(?:about|on|of))\s+(.+)$",
                flags,
            ), "youtube {1}"),

            # ─── OPEN YOUTUBE (no search query) ──────────────────
            (re.compile(
                r"^(?:open|launch|start|go\s+to|show)\s+youtube[.!?]*$",
                flags,
            ), "open youtube"),

            # ─── OPEN CHROME ──────────────────────────────────────
            (re.compile(
                r"^(?:open|launch|start)\s+(?:google\s+)?chrome[.!?]*$",
                flags,
            ), "open chrome"),

            # ─── OPEN VSCODE ──────────────────────────────────────
            (re.compile(
                r"^(?:open|launch|start)\s+(?:vs\s*code|visual\s+studio\s+code|code\s+editor)[.!?]*$",
                flags,
            ), "open vscode"),

            # ─── OPEN CALCULATOR ──────────────────────────────────
            (re.compile(
                r"^(?:open|launch|start)\s+(?:the\s+)?calculator[.!?]*$",
                flags,
            ), "open calculator"),

            # ─── OPEN NOTEPAD ─────────────────────────────────────
            (re.compile(
                r"^(?:open|launch|start)\s+(?:the\s+)?notepad[.!?]*$",
                flags,
            ), "open notepad"),

            # ─── TIME ────────────────────────────────────────────
            (re.compile(
                r"^(?:what(?:'s|\s+is)\s+the\s+time|tell\s+me\s+the\s+time|what\s+time\s+is\s+it|current\s+time|time\s+(?:please|now))[.!?]*$",
                flags,
            ), "time"),

            # ─── DATE ────────────────────────────────────────────
            (re.compile(
                r"^(?:what(?:'s|\s+is)\s+(?:the\s+|today(?:'s)?\s+)?date|what\s+day\s+is\s+it|today(?:'s)?\s+date|tell\s+me\s+the\s+date|current\s+date)[.!?]*$",
                flags,
            ), "date"),

            # ─── SYSTEM INFO ─────────────────────────────────────
            (re.compile(
                r"^(?:(?:show|get|display|tell\s+me)\s+(?:the\s+)?)?system\s+info(?:rmation)?[.!?]*$",
                flags,
            ), "system info"),

            # ─── HELP ────────────────────────────────────────────
            (re.compile(
                r"^(?:help|show\s+(?:me\s+)?(?:the\s+)?(?:help|commands|menu)|what\s+can\s+you\s+do)[.!?]*$",
                flags,
            ), "help"),
        ]

    def normalize(self, text: str) -> str:
        """
        Normalize a natural-language voice string into a canonical
        command string for CommandProcessor.

        Args:
            text: Raw transcribed speech text.

        Returns:
            A normalized command string. If no rule matches, returns
            the cleaned (stripped, lowered) original text — which will
            fall through to the AI Brain in CommandProcessor.
        """
        if not text or not text.strip():
            return ""

        cleaned = text.strip()

        for pattern, replacement in self._rules:
            match = pattern.match(cleaned)
            if match:
                if callable(replacement):
                    return replacement(match)

                # Substitute captured groups: {1}, {2}, etc.
                result = replacement
                for i, group in enumerate(match.groups(), start=1):
                    if group is not None:
                        result = result.replace(f"{{{i}}}", group.strip())

                return result

        # No rule matched — return cleaned lowercase text for AI Brain fallback
        return cleaned.lower().strip()
