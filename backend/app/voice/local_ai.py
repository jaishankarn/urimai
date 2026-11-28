"""A small local model for testing, so test runs do not spend Sarvam credits.

Any OpenAI-compatible server works, such as llama.cpp's server (`docker compose --profile local-ai up`) or
llama-cpp-python's. Quality is much lower than Sarvam's: use it to exercise the flow, not to judge understanding.
Only the AI step uses it (replies the rules cannot parse, and names in English letters); listening and speaking
still need Sarvam.
"""
import json
import logging
import os

import httpx2

from app.voice.base import VoiceError

log = logging.getLogger(__name__)
DEFAULT_URL = "http://localhost:8080/v1"


class LocalAI:
    def __init__(self, url: str | None = None, client: httpx2.Client | None = None):
        self.url = (url or os.environ.get("LOCAL_AI_URL", "").strip() or DEFAULT_URL).rstrip("/")
        self._client = client or httpx2.Client(timeout=httpx2.Timeout(60.0, connect=3.0))

    def chat_json(self, system: str, user: str, schema: dict) -> dict:
        try:
            response = self._client.post(f"{self.url}/chat/completions", json={
                "model": "local",
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "temperature": 0, "max_tokens": 200,
                # Both llama.cpp's server and llama-cpp-python constrain the output to this schema.
                "response_format": {"type": "json_object", "schema": schema}})
        except httpx2.HTTPError as error:
            raise VoiceError("provider", f"local model not reachable ({type(error).__name__})") from None
        if response.status_code != 200:
            log.warning("local model returned %s", response.status_code)
            raise VoiceError("provider", f"local model {response.status_code}")
        try:
            return json.loads(response.json()["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            raise VoiceError("provider", "bad local reply") from None

    def transliterate(self, text: str, lang: str) -> str:
        reply = self.chat_json(
            "Write the given Indian name in English letters, as it is usually spelt. Reply only with the name.",
            text, {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]})
        return str(reply.get("text", "")).strip()
