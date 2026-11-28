"""Sarvam adapter for the voice form widget (docs.sarvam.ai, read and tried with a real key on 28 Nov 2026).

The widget needs things the journey's client (sarvam.py) does not offer yet: listening modes (translit for names),
transliteration, a JSON-schema reply, slower speech, and errors mapped to plain codes. Folding both onto one client
is a follow-up.


- Listen: POST /speech-to-text, multipart `file`, `model`, `mode`, `language_code` -> {"transcript"}.
  Accepts WebM, OGG/Opus, MP4/M4A, WAV and more, so browser recordings are sent as they are. Under 30 s.
- Speak: POST /text-to-speech, JSON -> {"audios": [base64]}. Up to 2,500 characters.
- Transliterate: POST /transliterate -> {"transliterated_text"}.
- Chat: POST /v1/chat/completions (OpenAI shape) with a JSON schema response format.
Errors come as {"error": {"message", "code"}}; we keep only the code.
"""
import base64
import json
import logging
from collections.abc import Callable

import httpx2

from app.voice.base import ListenMode, VoiceError, sarvam_key

BASE = "https://api.sarvam.ai"
LANG_CODES = {"en": "en-IN", "ta": "ta-IN"}
STT_MODEL = "saaras:v4"   # default and recommended; supports `mode` (codemix, translit)
TTS_MODEL = "bulbul:v3"
TTS_SPEAKER = "kavitha"
CHAT_MODEL = "sarvam-105b"

log = logging.getLogger(__name__)


class SarvamVoice:
    def __init__(self, key: Callable[[], str | None] = sarvam_key, client: httpx2.Client | None = None, ai=None):
        self._key = key
        self._ai = ai  # a local model for the AI step (testing), instead of Sarvam's
        self._client = client or httpx2.Client(base_url=BASE, timeout=httpx2.Timeout(25.0, connect=5.0))

    def _headers(self) -> dict[str, str]:
        key = self._key()
        if not key:
            raise VoiceError("key_not_set")
        return {"api-subscription-key": key}

    def _post(self, path: str, **kwargs) -> dict:
        headers = {**self._headers(), **kwargs.pop("headers", {})}
        try:
            response = self._client.post(path, headers=headers, **kwargs)
        except httpx2.HTTPError as error:
            raise VoiceError("provider", type(error).__name__) from None
        if response.status_code == 200:
            return response.json()
        try:
            code = response.json()["error"]["code"]
        except Exception:
            code = "unknown"
        # Log the status and code only: never the request, the reply text or the key.
        log.warning("sarvam %s returned %s (%s)", path, response.status_code, code)
        if response.status_code == 429 or code in ("insufficient_quota_error", "rate_limit_exceeded_error"):
            raise VoiceError("quota", code)
        if response.status_code in (401, 403):
            raise VoiceError("key_not_set", code)
        raise VoiceError("provider", f"{response.status_code} {code}")

    def listen(self, audio: bytes, content_type: str, lang: str, mode: ListenMode) -> str:
        extension = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3",
                     "audio/wav": "wav", "audio/x-wav": "wav"}.get(content_type.split(";")[0].strip(), "webm")
        body = self._post("/speech-to-text",
                          files={"file": (f"reply.{extension}", audio, content_type)},
                          data={"model": STT_MODEL, "mode": mode, "language_code": LANG_CODES.get(lang, "unknown")})
        text = (body.get("transcript") or "").strip()
        if not text:
            raise VoiceError("unclear")
        return text

    def speak(self, text: str, lang: str) -> tuple[bytes, str]:
        body = self._post("/text-to-speech", json={
            "text": text, "language_code": LANG_CODES[lang], "model": TTS_MODEL, "speaker": TTS_SPEAKER,
            "pace": 0.9,  # a little slower for older listeners
            "output_audio_codec": "mp3"})
        audios = body.get("audios") or []
        if not audios:
            raise VoiceError("provider", "no audio")
        return b"".join(base64.b64decode(a) for a in audios), "audio/mpeg"

    def transliterate(self, text: str, lang: str) -> str:
        if self._ai:
            return self._ai.transliterate(text, lang)
        body = self._post("/transliterate", json={
            "input": text, "source_language_code": LANG_CODES.get(lang, "auto"), "target_language_code": "en-IN"})
        return (body.get("transliterated_text") or "").strip()

    def chat_json(self, system: str, user: str, schema: dict) -> dict:
        if self._ai:
            return self._ai.chat_json(system, user, schema)
        key = self._key()
        body = self._post("/v1/chat/completions", headers={"Authorization": f"Bearer {key}"}, json={
            "model": CHAT_MODEL,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0.1, "max_tokens": 800,
            "reasoning_effort": "low",  # the API accepts low, medium or high; reasoning counts against max_tokens
            "response_format": {"type": "json_schema",
                                "json_schema": {"name": "reply", "schema": schema, "strict": True}}})
        try:
            return json.loads(body["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            raise VoiceError("provider", "bad AI reply") from None
