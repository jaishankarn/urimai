"""Plain rules, no AI. Three-valued: met, not met, or unknown."""
from app.contracts.facts import Facts
from app.contracts.result import ConditionResult, Result
from app.contracts.scheme import Apply, Clause, Documents, PublicSource, Scheme, Text

NOT_CONFIRMED = Text(en="Not confirmed. Ask the office.", ta="உறுதிப்படுத்தப்படவில்லை. அலுவலகத்தில் கேளுங்கள்.")


def _clause(clause: Clause, facts: Facts) -> str:
    value = getattr(facts, clause.fact)
    if value is None or value == "unknown" or value in clause.unknown_values:
        return "unknown"
    if clause.op == "eq":
        holds = value == clause.value
    elif clause.op == "in":
        holds = value in clause.value
    elif clause.op == "min":
        holds = value >= clause.value
    else:
        holds = value <= clause.value
    return "met" if holds else "not_met"


def _all(statuses: list[str]) -> str:
    return "not_met" if "not_met" in statuses else "unknown" if "unknown" in statuses else "met"


def _any(statuses: list[str]) -> str:
    return "met" if "met" in statuses else "unknown" if "unknown" in statuses else "not_met"


def _evaluate_one(scheme: Scheme, facts: Facts) -> Result:
    conditions = []
    for c in scheme.conditions:
        status = "needs_check" if c.kind == "disputed" else _any(
            [_all([_clause(clause, facts) for clause in group]) for group in c.any_of])
        conditions.append(ConditionResult(id=c.id, text=c.text, status=status, source=c.source))

    statuses = {c.status for c in conditions}
    if not scheme.reviewed:
        outcome, conditions = "needs_more_information", []
    elif "not_met" in statuses:
        outcome = "appears_ineligible"
    elif statuses & {"unknown", "needs_check"}:
        outcome = "needs_more_information"
    else:
        outcome = "potentially_eligible"

    return Result(
        scheme_id=scheme.id, name=scheme.name, outcome=outcome, reviewed=scheme.reviewed,
        # An unreviewed rule names the scheme and its open questions only: an amount, a way to apply or a
        # document list would read as a checked match.
        amounts=[a.text for a in scheme.amounts if _all([_clause(w, facts) for w in a.when]) != "not_met"] if scheme.reviewed else [],
        conditions=conditions, checks=scheme.checks, conflicts=scheme.conflicts,
        documents=scheme.documents if scheme.reviewed else Documents(confirmed=False, note=NOT_CONFIRMED),
        apply=scheme.apply if scheme.reviewed else Apply(text=NOT_CONFIRMED),
        sources=[PublicSource(**s.model_dump(exclude={"local_file"})) for s in scheme.sources])


def evaluate(schemes: list[Scheme], facts: Facts) -> list[Result]:
    return [_evaluate_one(scheme, facts) for scheme in schemes]
