"""The routes that use the paid Sarvam services. Nothing said is stored or logged."""
import logging
import time
from collections import OrderedDict, deque
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from app.brain.extract import Understood, extract
from app.contracts.content import Content
from app.voice.sarvam import EXTENSIONS, configured_key, make_client

log = logging.getLogger("uvicorn.error")
Lang = Literal["en", "ta"]
MAX_AUDIO_BYTES = 5_000_000
# ponytail: one limit shared by everyone, to cap spending on a public link; limit per visitor if real users arrive.
CALLS_PER_MINUTE = 90
CACHED_LINES = 64


class Spoken(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lang: Lang
    text: str = Field(min_length=1, max_length=1200)


class Heard(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lang: Lang
    text: str = Field(min_length=1, max_length=1000)
    question_id: str | None = None


def router(lines: dict[str, Content]) -> APIRouter:
    api = APIRouter()
    calls: deque[float] = deque()
    audio_cache: OrderedDict[tuple[str, str], bytes] = OrderedDict()

    def client():
        key = configured_key()
        if key is None:
            raise HTTPException(503, "Sarvam key not set")
        return make_client(key)

    def paid(work):
        now = time.monotonic()
        while calls and now - calls[0] > 60:
            calls.popleft()
        if len(calls) >= CALLS_PER_MINUTE:
            raise HTTPException(429, "too many voice requests; wait a minute")
        calls.append(now)
        try:
            return work()
        except HTTPException:
            raise
        except Exception as error:
            # The type only: a message could repeat the key or what the person said.
            log.warning("Sarvam call failed (%s)", type(error).__name__)
            raise HTTPException(502, "voice service did not answer") from None

    @api.post("/api/voice/stt")
    async def speech_to_text(request: Request, lang: Lang) -> dict[str, str]:
        sarvam = client()
        content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type not in EXTENSIONS:
            raise HTTPException(415, "send recorded audio")
        if int(request.headers.get("content-length") or 0) > MAX_AUDIO_BYTES:
            raise HTTPException(413, "recording too long")
        audio = await request.body()
        if len(audio) > MAX_AUDIO_BYTES:
            raise HTTPException(413, "recording too long")
        if not audio:
            raise HTTPException(422, "empty recording")
        return {"text": await run_in_threadpool(paid, lambda: sarvam.transcribe(audio, content_type, lang))}

    @api.post("/api/voice/tts")
    def text_to_speech(body: Spoken) -> Response:
        sarvam = client()
        key = (body.lang, body.text)
        if key not in audio_cache:  # saved lines repeat, so do not pay for them twice
            audio_cache[key] = paid(lambda: sarvam.speak(body.text, body.lang))
            if len(audio_cache) > CACHED_LINES:
                audio_cache.popitem(last=False)
        return Response(audio_cache[key], media_type="audio/wav")

    @api.post("/api/conversation/understand")
    def understand(body: Heard) -> Understood:
        sarvam = client()
        question = None
        if body.question_id is not None:
            question = next((q for q in lines[body.lang].questions if q.id == body.question_id), None)
            if question is None:
                raise HTTPException(422, "unknown question")
        return paid(lambda: extract(sarvam.chat_json, body.text, question))

    return api
