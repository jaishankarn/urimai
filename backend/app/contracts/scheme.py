"""Shape of one reviewed rule file (content/schemes/<slug>/scheme.yaml)."""
import hashlib
import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError, model_validator

from app.contracts.facts import Facts


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Text(Strict):
    en: str
    ta: str


class Clause(Strict):
    fact: str
    op: Literal["eq", "in", "min", "max"]
    value: str | int | list[str]
    unknown_values: list[str] = []

    @model_validator(mode="after")
    def _fits_facts(self):
        if self.fact not in Facts.model_fields:
            raise ValueError(f"unknown fact {self.fact!r}")
        if self.op in ("min", "max"):
            values, wanted = [self.value], int
        else:
            values, wanted = (self.value if self.op == "in" else [self.value]), str
        if not isinstance(values, list) or not all(type(v) is wanted for v in values):
            raise ValueError(f'{self.fact} {self.op}: bad value {self.value!r} (quote "yes" and "no" in YAML)')
        for v in [*values, *self.unknown_values]:
            try:
                Facts(**{self.fact: v})
            except ValidationError as error:
                raise ValueError(f"{self.fact} cannot be {v!r}") from error
        return self


class Condition(Strict):
    id: str
    text: Text
    kind: Literal["checkable", "disputed"]
    any_of: list[list[Clause]]  # either-or groups; every clause in a group must hold
    source: str


class Note(Strict):
    id: str
    text: Text
    source: str | None = None


class Amount(Strict):
    text: Text
    source: str
    when: list[Clause] = []


class Document(Strict):
    id: str
    text: Text
    how: Text | None = None


class Documents(Strict):
    confirmed: bool
    note: Text | None = None
    items: list[Document] = []


class Apply(Strict):
    text: Text
    service_code: str | None = None
    charge_rupees: int | None = None
    source: str | None = None


class PublicSource(Strict):
    id: str
    title: str
    url: str
    type: str
    source_date: str | None = None
    checked_on: str
    quote: str


class Source(PublicSource):
    local_file: str | None = None


class Review(Strict):
    by: str
    on: str
    checksum: str


class Scheme(Strict):
    id: str
    name: Text
    aliases: list[str]
    conditions: list[Condition]
    checks: list[Note]
    conflicts: list[Note]
    amounts: list[Amount]
    documents: Documents
    apply: Apply
    sources: list[Source]
    review: Review | None = None
    government_order_verified: bool

    @model_validator(mode="after")
    def _sources_exist(self):
        known = {s.id for s in self.sources}
        used = [c.source for c in self.conditions] + [a.source for a in self.amounts]
        used += [n.source for n in [*self.checks, *self.conflicts] if n.source]
        used += [self.apply.source] if self.apply.source else []
        if missing := sorted(set(used) - known):
            raise ValueError(f"{self.id}: sources not listed: {missing}")
        return self

    def checksum(self) -> str:
        """Fingerprint of what a reviewer approves."""
        approved = self.model_dump(mode="json", include={"conditions", "checks", "amounts"})
        return hashlib.sha256(json.dumps(approved, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

    @property
    def reviewed(self) -> bool:
        return self.review is not None and self.review.checksum == self.checksum()
