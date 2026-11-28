import pytest
from fastapi.testclient import TestClient

from app.api.content import load_lines
from app.brain.questions import next_question
from app.brain.suggest import suggest
from app.contracts.facts import Facts
from app.eligibility.engine import evaluate
from app.main import CONTENT_DIR, create_app
from conftest import DEMO_FACTS

STORY = dict(age=58, lives_in_tn="yes", widowed="yes", husband_work="construction", death_cause="natural")


@pytest.fixture
def lines():
    return load_lines(CONTENT_DIR)


def ask_all(schemes, lines, start, answers=DEMO_FACTS, dont_know=()):
    known, asked, skipped = dict(start), [], []
    while (question := next_question(schemes, lines["en"].questions, Facts(**known), skipped)):
        assert question not in asked, "asked twice"
        asked.append(question)
        if question in dont_know:
            skipped.append(question)
        else:
            known[question] = answers.get(question, "unknown")
    return asked


def test_the_demo_story_needs_six_follow_ups(schemes, lines):
    assert ask_all(schemes, lines, STORY) == ["husband_age_at_death", "husband_main_earner", "husband_board_registered",
                                             "insurance_deduction", "property_value", "bpl_card"]


def test_a_shorter_story_asks_more_and_widowhood_comes_before_questions_about_him(schemes, lines):
    asked = ask_all(schemes, lines, {"age": 58})
    assert asked.index("widowed") < asked.index("husband_age_at_death") and "district" not in asked


def test_questions_no_rule_uses_are_never_asked(schemes, lines):
    assert not {"district", "area", "husband_death_when", "own_income", "adult_relative_at_home"} & set(ask_all(schemes, lines, {}))


def test_at_work_is_asked_only_after_an_accident(schemes, lines):
    assert "death_at_work" not in ask_all(schemes, lines, STORY)
    assert "death_at_work" in ask_all(schemes, lines, {**STORY, "death_cause": "accident"}, {**DEMO_FACTS, "husband_board_registered": "no"})


def test_dont_know_for_a_number_is_not_asked_again(schemes, lines):
    assert ask_all(schemes, lines, STORY, dont_know=("husband_age_at_death",)).count("husband_age_at_death") == 1


def test_a_living_husband_means_no_questions_about_his_death(schemes, lines):
    assert not [q for q in ask_all(schemes, lines, {"age": 45, "widowed": "no"}) if q.startswith(("husband", "death", "insurance"))]


def suggestions(schemes, lines, lang="en", **changes):
    return suggest(evaluate(schemes, Facts(**{**DEMO_FACTS, **changes})), lines[lang].ui, lang)


@pytest.mark.parametrize("lang", ["en", "ta"])
def test_demo_gives_three_suggestions_in_a_fixed_order(schemes, lines, lang):
    found = suggestions(schemes, lines, lang)
    assert [s.scheme_ids for s in found.suggestions] == [
        ["destitute-widow-pension", "national-widow-pension"], ["construction-board-death"], ["national-family-benefit"]]
    assert found.others == []
    spoken = " ".join(found.speech)
    ui = lines[lang].ui
    assert ui["say_intro"] in spoken and ui["group_widow_both_note"] in spoken and ui["say_deadline_tip"] in spoken
    assert all(len(part) <= 1200 for part in found.speech) and "{" not in spoken


def test_every_amount_and_check_spoken_comes_from_the_rules(schemes, lines):
    found = suggestions(schemes, lines)
    amounts = {a.text.en for s in schemes for a in s.amounts}
    checks = {c.text.en for s in schemes for c in s.checks}
    assert all(a.split(": ", 1)[-1] in amounts for s in found.suggestions for a in s.amounts)
    assert all(s.check in checks for s in found.suggestions)


def test_a_fourth_match_is_never_hidden(schemes, lines):
    found = suggestions(schemes, lines, insurance_deduction="life")
    assert len(found.suggestions) == 3 and [o.id for o in found.others] == ["pmjjby"]
    assert lines["en"].ui["say_more"].format(count=1) in found.speech


def test_unreviewed_rules_are_never_suggested(schemes, lines):
    found = suggest(evaluate([s.model_copy(update={"review": None}) for s in schemes], Facts(**DEMO_FACTS)), lines["en"].ui, "en")
    assert found.suggestions == [] and "₹" not in " ".join(found.speech)


def test_routes(tmp_path):
    client = TestClient(create_app(tmp_path / "missing"))
    assert client.post("/api/conversation/next", json={"facts": STORY}).json() == {"question_id": "husband_age_at_death"}
    body = client.post("/api/conversation/suggest", json={"facts": DEMO_FACTS, "lang": "ta"}).json()
    assert len(body["suggestions"]) == 3 and body["speech"]
    assert client.post("/api/conversation/next", json={"facts": {"aadhaar": "1"}}).status_code == 422
