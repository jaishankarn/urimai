"""The only code that talks to Sarvam. The form widget should reuse this.

Audio and text pass through to Sarvam and are not stored or logged here.
"""
import base64
import io
import os
from functools import lru_cache

# Value shipped in .env.example; copying that file unchanged must not count as a key.
PLACEHOLDER_KEY = "your_sarvam_key_here"
STT_MODEL, TTS_MODEL, CHAT_MODEL = "saaras:v4", "bulbul:v3", "sarvam-105b-conversations"
LANGUAGE_CODES = {"en": "en-IN", "ta": "ta-IN"}
EXTENSIONS = {"audio/webm": "webm", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/ogg": "ogg",
              "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3"}


def configured_key() -> str | None:
    """Read at call time, on the server only."""
    key = os.environ.get("SARVAM_API_KEY", "").strip()
    return key if key not in ("", PLACEHOLDER_KEY) else None


class SarvamVoice:
    def __init__(self, key: str):
        from sarvamai import SarvamAI

        self._client = SarvamAI(api_subscription_key=key, timeout=30)

    def transcribe(self, audio: bytes, content_type: str, lang: str) -> str:
        file = (f"speech.{EXTENSIONS[content_type]}", io.BytesIO(audio), content_type)
        # codemix keeps English words in English inside Tamil speech.
        reply = self._client.speech_to_text.transcribe(file=file, model=STT_MODEL, mode="codemix", language_code=LANGUAGE_CODES[lang])
        return (reply.transcript or "").strip()

    def speak(self, text: str, lang: str) -> bytes:
        reply = self._client.text_to_speech.convert(text=text, language_code=LANGUAGE_CODES[lang], model=TTS_MODEL)
        return base64.b64decode("".join(reply.audios))

    def chat_json(self, system: str, user: str) -> str:
        reply = self._client.chat.completions(
            model=CHAT_MODEL, temperature=0, max_tokens=800, response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
        return reply.choices[0].message.content or ""


@lru_cache(maxsize=1)
def make_client(key: str) -> SarvamVoice:
    return SarvamVoice(key)
