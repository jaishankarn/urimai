from typing import Literal

from pydantic import BaseModel

from app.contracts.scheme import Apply, Documents, Note, PublicSource, Text

Outcome = Literal["potentially_eligible", "needs_more_information", "appears_ineligible"]
Status = Literal["met", "not_met", "unknown", "needs_check"]


class ConditionResult(BaseModel):
    id: str
    text: Text
    status: Status
    source: str


class Result(BaseModel):
    scheme_id: str
    name: Text
    outcome: Outcome
    reviewed: bool
    amounts: list[Text]
    conditions: list[ConditionResult]
    checks: list[Note]
    conflicts: list[Note]
    documents: Documents
    apply: Apply
    sources: list[PublicSource]
