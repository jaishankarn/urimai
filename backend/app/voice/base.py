import os
from typing import Literal, Protocol

# Value shipped in .env.example; copying that file unchanged must not count as a key.
PLACEHOLDER_KEY = "your_sarvam_key_here"

ListenMode = Literal["transcribe", "codemix", "translit"]


def sarvam_key() -> str | None:
    key = os.environ.get("SARVAM_API_KEY", "").strip()
    return None if key in ("", PLACEHOLDER_KEY) else key


class VoiceError(Exception):
    """kind: key_not_set | quota | unclear | provider. The message never contains user data or the key."""

    def __init__(self, kind: str, detail: str = ""):
        super().__init__(f"{kind}: {detail}" if detail else kind)
        self.kind = kind


class Voice(Protocol):
    def listen(self, audio: bytes, content_type: str, lang: str, mode: ListenMode) -> str: ...

    def speak(self, text: str, lang: str) -> tuple[bytes, str]:
        """Returns (audio bytes, media type)."""
        ...

    def transliterate(self, text: str, lang: str) -> str: ...

    def chat_json(self, system: str, user: str, schema: dict) -> dict: ...


def ai_provider() -> str:
    """Which model understands replies the rules cannot parse: "sarvam" (default) or "local" (for testing)."""
    return "local" if os.environ.get("AI_PROVIDER", "").strip().lower() == "local" else "sarvam"


def ai_available() -> bool:
    return ai_provider() == "local" or sarvam_key() is not None
