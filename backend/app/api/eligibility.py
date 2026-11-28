from fastapi import APIRouter

from app.contracts.facts import Facts
from app.contracts.result import Result
from app.contracts.scheme import Scheme
from app.eligibility.engine import evaluate


def router(schemes: list[Scheme]) -> APIRouter:
    api = APIRouter()

    # POST so that personal details never appear in an address or access log. Nothing is stored.
    @api.post("/api/eligibility")
    def eligibility(facts: Facts) -> dict[str, list[Result]]:
        return {"results": evaluate(schemes, facts)}

    return api
