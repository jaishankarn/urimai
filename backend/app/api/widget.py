"""Routes the voice form widget calls from an application page. Cross-origin only for registered origins."""
import datetime as dt
import hashlib
from collections import OrderedDict
from urllib.parse import urlsplit

from fastapi import APIRouter, File, Form, Header, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.contracts.facts import Facts
from app.contracts.forms import FormField, FormMap
from app.contracts.handoff import (Plan, PlanField, SessionRequest, SpeakRequest, TransliterateRequest,
                                   UnderstandRequest, Understanding, VoiceAvailability)
from app.forms.loader import FormRegistry
from app.handoff.store import RateLimit, Session, Store
from app.understand.ai import understand_with_ai
from app.understand.rules import understand
from app.voice.base import Voice, VoiceError, ai_available, sarvam_key

MAX_AUDIO = 2 * 1024 * 1024  # about 30 s of browser Opus audio is well under this
PREFIX = "/api/widget/"


def error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"error": code}, status_code=status)


def resolve(field: FormField, facts: Facts | None) -> str | None:
    """A value known from the confirmed facts, or None to ask. Unknown and unmapped values are asked."""
    if facts is None or not field.source or not field.source.startswith("facts."):
        return None
    value = getattr(facts, field.source.removeprefix("facts."))
    if value is None or value == "unknown":
        return None
    value = str(value)
    if field.map is not None:
        return field.map.get(value)
    return value


def plan_field(field: FormField, facts: Facts | None) -> PlanField:
    return PlanField(**field.model_dump(exclude={"map"}),
                     value=resolve(field, facts) if field.mode in ("fill", "check") else None)


def allowed(form: FormMap, origin: str | None, host: str | None) -> bool:
    if origin is None:
        return "self" in form.site.origins
    if "self" in form.site.origins and urlsplit(origin).netloc == host:
        return True
    return origin in form.site.origins


class WidgetCors(BaseHTTPMiddleware):
    """Answer cross-origin calls to /api/widget/ only from registered origins, reflecting the exact origin."""

    def __init__(self, app, origins: set[str]):
        super().__init__(app)
        self.origins = origins

    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        if not request.url.path.startswith(PREFIX) or origin not in self.origins:
            return await call_next(request)
        if request.method == "OPTIONS":
            response = Response(status_code=204, headers={
                "Access-Control-Allow-Methods": "POST", "Access-Control-Max-Age": "600",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"})
        else:
            response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        return response


def router(registry: FormRegistry, store: Store, voice: Voice, session_limit: RateLimit | None = None) -> APIRouter:
    api = APIRouter()
    session_limit = session_limit or RateLimit(limit=30, window=600)
    speech_cache: OrderedDict[str, tuple[bytes, str]] = OrderedDict()

    def availability() -> VoiceAvailability:
        on, ai = sarvam_key() is not None, ai_available()
        return VoiceAvailability(listen=on, speak=on, understand=ai, transliterate=ai)

    def session_for(authorization: str | None, action: str | None = None) -> Session | JSONResponse:
        token = (authorization or "").removeprefix("Bearer ").strip()
        found = store.use(token, action) if token else None
        if found is None:
            return error(401, "session_expired")
        if found == "quota":
            return error(429, "quota")
        return found

    def voice_error(e: VoiceError) -> JSONResponse:
        return {"key_not_set": error(503, "key_not_set"), "quota": error(503, "voice_paused"),
                "unclear": error(422, "unclear")}.get(e.kind, error(502, "voice_failed"))

    @api.post(PREFIX + "session")
    def session(body: SessionRequest, request: Request):
        if not session_limit.allow(request.client.host if request.client else "?"):
            return error(429, "too_many_sessions")
        forms = registry.for_site(body.site_key)
        if not forms:
            return error(404, "unknown_site")
        form = forms[0]
        if not allowed(form, request.headers.get("origin"), request.headers.get("host")):
            return error(403, "origin_not_registered")
        facts, lang, carried = None, body.lang or "ta", False
        if body.code:
            handoff = store.take_code(body.code)
            if handoff is None:
                return error(410, "code_expired")
            if handoff.form_id != form.id:
                return error(403, "code_for_other_site")
            facts, lang, carried = handoff.facts, body.lang or handoff.lang, True
        token, expires = store.create_session(form.id, form.site.key, lang)
        return Plan(
            form_id=form.id, title=form.title, lang=lang, demo=form.demo, carried=carried,
            fingerprint=form.fingerprint, pages=form.site.pages, finish_page=form.finish_page,
            fields=[plan_field(f, facts) for f in form.fields], lines=registry.lines, token=token,
            expires_at=dt.datetime.fromtimestamp(expires, dt.UTC).isoformat(), voice=availability())

    @api.post(PREFIX + "listen")
    async def listen(audio: UploadFile = File(...), lang: str = Form("ta"), mode: str = Form("codemix"),
                     authorization: str | None = Header(None)):
        found = session_for(authorization, "listen")
        if isinstance(found, JSONResponse):
            return found
        data = await audio.read(MAX_AUDIO + 1)
        if len(data) > MAX_AUDIO:
            return error(413, "audio_too_long")
        if len(data) < 500:
            return error(422, "unclear")
        try:
            text = voice.listen(data, audio.content_type or "audio/webm", lang if lang in ("en", "ta") else "ta",
                                mode if mode in ("transcribe", "codemix", "translit") else "codemix")
        except VoiceError as e:
            return voice_error(e)
        return {"text": text}

    @api.post(PREFIX + "speak")
    def speak(body: SpeakRequest, authorization: str | None = Header(None)):
        key = hashlib.sha256(f"{body.lang}\n{body.text}".encode()).hexdigest()
        cached = speech_cache.get(key)
        found = session_for(authorization, None if cached else "speak")
        if isinstance(found, JSONResponse):
            return found
        if cached is None:
            try:
                cached = voice.speak(body.text, body.lang)
            except VoiceError as e:
                return voice_error(e)
            speech_cache[key] = cached
            while len(speech_cache) > 300:
                speech_cache.popitem(last=False)
        speech_cache.move_to_end(key)
        return Response(cached[0], media_type=cached[1], headers={"Cache-Control": "private, max-age=3600"})

    @api.post(PREFIX + "understand")
    def understand_reply(body: UnderstandRequest, authorization: str | None = Header(None)) -> Understanding:
        found = session_for(authorization)
        if isinstance(found, JSONResponse):
            return found
        result = understand(body.field, body.expecting, body.utterance)
        needs_ai = result.intent == "unclear" or (result.intent == "no" and result.value is None and
                                                   body.expecting == "confirm" and len(body.utterance.split()) > 2)
        if needs_ai and ai_available() and store.use(found_token(authorization), "understand") not in (None, "quota"):
            return understand_with_ai(voice, body.field, body.expecting, body.utterance)
        return result

    def found_token(authorization: str | None) -> str:
        return (authorization or "").removeprefix("Bearer ").strip()

    @api.post(PREFIX + "transliterate")
    def transliterate(body: TransliterateRequest, authorization: str | None = Header(None)):
        found = session_for(authorization, "transliterate")
        if isinstance(found, JSONResponse):
            return found
        try:
            return {"text": voice.transliterate(body.text, body.lang)}
        except VoiceError as e:
            return voice_error(e)

    @api.post(PREFIX + "end")
    def end(authorization: str | None = Header(None)):
        store.end(found_token(authorization))
        return {"ended": True}

    return api
