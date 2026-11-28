"""Conversation steps that need no AI and no key."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.brain.questions import next_question
from app.brain.suggest import Suggestions, suggest
from app.contracts.content import Content
from app.contracts.facts import Facts
from app.contracts.scheme import Scheme
from app.eligibility.engine import evaluate


class Known(BaseModel):
    model_config = ConfigDict(extra="forbid")
    facts: Facts
    skipped: list[str] = Field(default=[], max_length=30)  # number questions answered "I don't know"


class Confirmed(BaseModel):
    model_config = ConfigDict(extra="forbid")
    facts: Facts
    lang: Literal["en", "ta"]


def router(schemes: list[Scheme], lines: dict[str, Content]) -> APIRouter:
    api = APIRouter()

    @api.post("/api/conversation/next")
    def next_step(body: Known) -> dict[str, str | None]:
        return {"question_id": next_question(schemes, lines["en"].questions, body.facts, body.skipped)}

    @api.post("/api/conversation/suggest")
    def suggestions(body: Confirmed) -> Suggestions:
        return suggest(evaluate(schemes, body.facts), lines[body.lang].ui, body.lang)

    return api
