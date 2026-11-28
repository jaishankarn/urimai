"""Choose the next question. Code decides this, not an AI: only a question that can still change a result."""
from app.contracts.content import Question
from app.contracts.facts import Facts
from app.contracts.scheme import Scheme
from app.eligibility.engine import clause_status, evaluate


def _wanted(schemes: list[Scheme], facts: Facts) -> set[str]:
    ruled_out = {r.scheme_id for r in evaluate(schemes, facts) if r.outcome == "appears_ineligible"}
    wanted: set[str] = set()
    for scheme in schemes:
        if scheme.id in ruled_out:
            continue
        for condition in scheme.conditions:
            groups = [[(c, clause_status(c, facts)) for c in group] for group in condition.any_of]
            if any(all(status == "met" for _, status in group) for group in groups):
                continue  # already satisfied by one route
            for group in groups:
                if all(status != "not_met" for _, status in group):
                    wanted |= {c.fact for c, _ in group if getattr(facts, c.fact) is None}
    return wanted


def next_question(schemes: list[Scheme], questions: list[Question], facts: Facts, skipped: list[str]) -> str | None:
    """The first unanswered question, in the saved order, that is visible and still matters. None when done."""
    wanted = _wanted(schemes, facts) - set(skipped)
    visible: set[str] = set()
    for question in questions:
        if all(fact in visible and getattr(facts, fact) in values for fact, values in (question.show_if or {}).items()):
            visible.add(question.id)
            if question.id in wanted:
                return question.id
    return None
