import pytest

from app.contracts.facts import Facts
from app.contracts.scheme import Review
from app.eligibility.engine import evaluate
from conftest import DEMO_FACTS

EXPECTED = {
    "destitute-widow-pension": "potentially_eligible", "national-widow-pension": "potentially_eligible",
    "national-family-benefit": "potentially_eligible", "construction-board-death": "potentially_eligible",
    "pmjjby": "needs_more_information", "national-old-age-pension": "appears_ineligible",
    "manual-board-death": "appears_ineligible", "pmsby": "appears_ineligible",
}


def reviewed(schemes):
    """Test-only: mark copies as reviewed. The committed files are reviewed by a person."""
    return [s.model_copy(update={"review": Review(by="test", on="2026-11-28", checksum=s.checksum())}) for s in schemes]


def results(schemes, **changes):
    return {r.scheme_id: r for r in evaluate(schemes, Facts(**{**DEMO_FACTS, **changes}))}


def outcomes(schemes, **changes):
    return {k: r.outcome for k, r in results(schemes, **changes).items()}


def test_demo_story(schemes):
    assert outcomes(reviewed(schemes)) == EXPECTED


def test_unreviewed_rules_never_give_another_outcome(schemes):
    found = evaluate([s.model_copy(update={"review": None}) for s in schemes], Facts(**DEMO_FACTS))
    assert {r.outcome for r in found} == {"needs_more_information"}
    assert all(r.conditions == [] and not r.reviewed for r in found)
    widow = next(r for r in found if r.scheme_id == "destitute-widow-pension")
    assert widow.checks and widow.conflicts


def test_editing_a_reviewed_rule_makes_it_unreviewed(schemes):
    rule = reviewed(schemes)[0]
    assert rule.reviewed
    rule.conditions[0].any_of[0][0].value = "no"
    assert not rule.reviewed


@pytest.mark.parametrize("value", [None, "unknown"])
def test_unknown_is_never_no(schemes, value):
    assert outcomes(reviewed(schemes), bpl_card=value)["national-widow-pension"] == "needs_more_information"


@pytest.mark.parametrize("field, value, scheme, expected", [
    ("age", 17, "destitute-widow-pension", "appears_ineligible"),
    ("age", 18, "destitute-widow-pension", "potentially_eligible"),
    ("age", 59, "national-old-age-pension", "appears_ineligible"),
    ("age", 60, "national-old-age-pension", "potentially_eligible"),
    ("age", 39, "national-widow-pension", "appears_ineligible"),
    ("age", 40, "national-widow-pension", "potentially_eligible"),
    ("husband_age_at_death", 59, "national-family-benefit", "potentially_eligible"),
    ("husband_age_at_death", 60, "national-family-benefit", "appears_ineligible"),
    ("husband_age_at_death", 55, "pmjjby", "needs_more_information"),
    ("husband_age_at_death", 56, "pmjjby", "appears_ineligible"),
    ("property_value", "50000_to_100000", "destitute-widow-pension", "potentially_eligible"),
    ("property_value", "over_100000", "destitute-widow-pension", "appears_ineligible"),
    ("husband_work", "farm_labour", "manual-board-death", "needs_more_information"),
    ("husband_work", "other_manual", "manual-board-death", "potentially_eligible"),
    ("insurance_deduction", "life", "pmjjby", "potentially_eligible"),
    ("insurance_deduction", "none", "pmjjby", "appears_ineligible"),
    ("lives_in_tn", "no", "destitute-widow-pension", "appears_ineligible"),
])
def test_edges(schemes, field, value, scheme, expected):
    assert outcomes(reviewed(schemes), **{field: value})[scheme] == expected


def test_worksite_route_needs_an_accident(schemes):
    ready = reviewed(schemes)
    base = dict(husband_board_registered="no")
    stale = outcomes(ready, **base, death_cause="natural", death_at_work="yes")
    assert stale["construction-board-death"] == "appears_ineligible"
    at_work = outcomes(ready, **base, death_cause="accident", death_at_work="yes")
    assert at_work["construction-board-death"] == "potentially_eligible"


def amounts(schemes, **changes):
    found = results(reviewed(schemes), **changes)["construction-board-death"]
    return " ".join(a.en for a in found.amounts)


def test_amounts_follow_cause_of_death(schemes):
    natural = amounts(schemes)
    assert "50,000" in natural and "2,00,000" not in natural and "5,00,000" not in natural
    unknown = amounts(schemes, death_cause="unknown")
    assert "50,000" in unknown and "2,00,000" in unknown and "5,00,000" in unknown


def test_disputed_condition_needs_information(schemes):
    ready = reviewed(schemes)
    ready[0].conditions[0].kind = "disputed"
    ready[0].review.checksum = ready[0].checksum()
    found = results(ready)[ready[0].id]
    assert found.outcome == "needs_more_information"
    assert found.conditions[0].status == "needs_check"


def test_destitute_is_a_check_not_a_condition(schemes):
    found = results(reviewed(schemes))["destitute-widow-pension"]
    assert any("destitute" in c.text.en.lower() for c in found.checks) and found.conflicts
    assert not any("destitute" in c.text.en.lower() for c in found.conditions)
