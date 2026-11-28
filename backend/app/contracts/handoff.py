"""Shapes passed between the Urimai website, the server and the voice form widget."""
from typing import Literal

from pydantic import Field

from app.contracts.facts import Facts
from app.contracts.forms import Find, Fingerprint, Kind, Mode
from app.contracts.scheme import Strict, Text

Lang = Literal["en", "ta"]


class FormSummary(Strict):
    form_id: str
    title: Text
    start_url: str
    demo: bool


class HandoffRequest(Strict):
    form_id: str
    lang: Lang
    facts: Facts  # the confirmed answers; Facts hold no identity details


class HandoffResponse(Strict):
    url: str  # start_url + "#urimai=" + one-time code


class SessionRequest(Strict):
    site_key: str
    code: str | None = Field(None, max_length=64)  # None = started from the page's own "Fill by voice" button
    lang: Lang | None = None


class PlanField(Strict):
    key: str
    find: Find
    mode: Mode
    kind: Kind | None
    format: str | None
    source: str | None
    value: str | None  # resolved from facts; never for user, next or submit fields
    aliases: dict[str, list[str]] | None
    page: str
    optional: bool
    reloads: bool
    frame: str | None
    label: Text | None
    ask: Text | None
    say: Text | None
    help: Text | None


class VoiceAvailability(Strict):
    listen: bool
    speak: bool
    understand: bool  # the AI fallback; the built-in rules always work
    transliterate: bool


class Plan(Strict):
    form_id: str
    title: Text
    lang: Lang
    demo: bool
    carried: bool  # values came from Urimai through a handoff
    fingerprint: Fingerprint
    pages: list[str]
    finish_page: str
    fields: list[PlanField]
    lines: dict[str, dict[str, str]]  # widget lines by language, so a mid-form language switch needs no call
    token: str
    expires_at: str
    voice: VoiceAvailability


Expecting = Literal["confirm", "value", "done"]
Intent = Literal["yes", "no", "value", "done", "repeat", "skip", "stop", "back", "help", "unclear"]


class FieldInfo(Strict):
    key: str
    kind: Kind | None = None
    label: str = Field("", max_length=200)
    options: list[str] = Field([], max_length=400)
    aliases: dict[str, list[str]] | None = None


class UnderstandRequest(Strict):
    field: FieldInfo
    expecting: Expecting
    utterance: str = Field(max_length=500)
    lang: Lang


class Understanding(Strict):
    intent: Intent
    value: str | None = None  # normalised, ready to fill
    by: Literal["rules", "ai"] = "rules"
    problem: str | None = None  # line key explaining why a value was not accepted


class SpeakRequest(Strict):
    text: str = Field(min_length=1, max_length=600)
    lang: Lang


class TransliterateRequest(Strict):
    text: str = Field(min_length=1, max_length=200)
    lang: Lang = "ta"
