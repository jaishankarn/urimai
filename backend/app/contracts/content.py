"""Shape of the screen text and questions (content/lines/<lang>.yaml)."""
from typing import Literal

from pydantic import BaseModel, ConfigDict


class Option(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str
    label: str


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    type: Literal["choice", "number", "select"]
    text: str
    options: list[Option] | None = None
    show_if: dict[str, list[str]] | None = None
    min: int | None = None
    max: int | None = None


class Content(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ui: dict[str, str]
    questions: list[Question]
