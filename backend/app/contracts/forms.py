"""Shape of one form map (content/forms/<form_id>.yaml): how the widget fills one application form.

A form map is data only. The widget has no code for any particular site.
"""
import re
from typing import Literal

from pydantic import Field, model_validator

from app.contracts.facts import Facts
from app.contracts.scheme import Strict, Text

Mode = Literal["fill", "check", "attach", "user", "next", "submit"]
Kind = Literal["text", "name_native", "name_latin", "digits", "mobile", "pincode", "email", "date", "choice",
               "address"]

# A control is sensitive if its name, id, selector or label matches this. The widget has the same detector
# (widget/src/dom/sensitive.ts); keep the two in step. "pin code" is a postal code, not a PIN.
SENSITIVE = re.compile(
    r"aadhaa?r|\buid\b|\botp\b|one.?time|captcha|security code|password|passwd|\bpin\b(?!\s*code)|\bcvv\b|"
    r"(?:^|[^n]\s)card\s*(?:no|number)|(?:credit|debit|atm) card|account (no|number)|\bifsc\b|கடவுச்சொல்|ஆதார்",
    re.IGNORECASE)


def is_sensitive(*texts: str) -> bool:
    return any(SENSITIVE.search(t) for t in texts if t)


class Find(Strict):
    selector: str | None = None
    labels: list[str] = []

    @model_validator(mode="after")
    def _one_way(self):
        if not self.selector and not self.labels:
            raise ValueError("find needs a selector or label hints")
        return self


class FormField(Strict):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    find: Find
    mode: Mode
    kind: Kind | None = None
    format: str | None = None        # upper | lower | a date format such as dd/mm/yyyy
    # ask | facts.<name> | field.<key> (derived from another confirmed field, e.g. an English name from the
    # Tamil one) | carried.<key> (applicant details carried with consent; later)
    source: str | None = None
    map: dict[str, str] | None = None             # fact value -> option text; anything unmapped is asked
    aliases: dict[str, list[str]] | None = None   # option text -> spoken words in any language
    page: str                                     # path of the page this field is on
    optional: bool = False
    reloads: bool = False                         # choosing a value reloads the page (postback)
    frame: str | None = None                      # selector of the same-site frame holding the field
    label: Text | None = None
    ask: Text | None = None
    say: Text | None = None
    help: Text | None = None

    @model_validator(mode="after")
    def _consistent(self):
        acting = self.mode in ("fill", "check", "attach")
        if acting and not self.label:
            raise ValueError(f"{self.key}: a {self.mode} field needs a label")
        if self.mode in ("user", "next", "submit") and not self.say:
            raise ValueError(f"{self.key}: a {self.mode} field needs 'say'")
        if self.mode in ("fill", "check") and not self.kind:
            raise ValueError(f"{self.key}: a {self.mode} field needs a kind")
        if self.mode in ("user", "next", "submit") and self.source:
            raise ValueError(f"{self.key}: a {self.mode} field cannot have a source")
        if self.mode == "fill" and not self.source:
            raise ValueError(f"{self.key}: a fill field needs a source")
        if self.source:
            where, _, name = self.source.partition(".")
            if self.source != "ask" and (where not in ("facts", "field", "carried") or not name):
                raise ValueError(f"{self.key}: bad source {self.source!r}")
            if where == "facts" and name not in Facts.model_fields:
                raise ValueError(f"{self.key}: unknown fact {name!r}")
        if self.mode == "fill" and self.source == "ask" and not self.ask:
            raise ValueError(f"{self.key}: a field the widget asks for needs 'ask'")
        hints = [self.key, self.find.selector or "", *self.find.labels]
        if self.mode != "user" and is_sensitive(*hints):
            raise ValueError(f"{self.key}: looks sensitive, so its mode must be 'user'")
        return self


class Site(Strict):
    key: str = Field(pattern=r"^[a-z0-9-]+$")
    origins: list[str]
    start_url: str
    pages: list[str]

    @model_validator(mode="after")
    def _origins(self):
        for origin in self.origins:
            local = re.fullmatch(r"http://(localhost|127\.0\.0\.1)(:\d+)?", origin)  # tests and development
            if origin != "self" and not local and not re.fullmatch(r"https://[a-z0-9.-]+(:\d+)?", origin):
                raise ValueError(f"origin must be 'self' or a full https:// origin, not {origin!r}")
        if self.start_url not in self.pages:
            raise ValueError("start_url must be one of pages")
        return self


class Fingerprint(Strict):
    labels: list[str]
    min_match: int = Field(ge=1)

    @model_validator(mode="after")
    def _reachable(self):
        if self.min_match > len(self.labels):
            raise ValueError("min_match is larger than the number of labels")
        return self


class FormMap(Strict):
    id: str
    scheme_id: str
    service_code: str | None = None
    title: Text
    demo: bool = False
    site: Site
    fingerprint: Fingerprint
    finish_page: str
    fields: list[FormField]

    @model_validator(mode="after")
    def _fields(self):
        keys = [f.key for f in self.fields]
        if dupes := sorted({k for k in keys if keys.count(k) > 1}):
            raise ValueError(f"{self.id}: duplicate field keys {dupes}")
        if [f.mode for f in self.fields].count("submit") != 1:
            raise ValueError(f"{self.id}: needs exactly one submit field")
        if self.finish_page not in self.site.pages:
            raise ValueError(f"{self.id}: finish_page must be one of site.pages")
        for f in self.fields:
            if f.page not in self.site.pages:
                raise ValueError(f"{self.id}: {f.key} is on unknown page {f.page}")
            if f.source and f.source.startswith("field."):
                other = f.source.removeprefix("field.")
                if other not in keys or keys.index(other) >= keys.index(f.key):
                    raise ValueError(f"{self.id}: {f.key} derives from {other}, which must come earlier")
        return self
