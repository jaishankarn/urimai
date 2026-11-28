from typing import get_args

import pytest
from fastapi.testclient import TestClient

from app.contracts.facts import District, Facts
from app.main import create_app


@pytest.fixture
def content(tmp_path):
    client = TestClient(create_app(tmp_path / "missing"))
    return {lang: client.get(f"/api/content/{lang}").json() for lang in ("en", "ta")}


def shape(questions):
    return [(q["id"], q["type"], [o["value"] for o in q["options"] or []], q["show_if"], q["min"], q["max"]) for q in questions]


def test_languages_match(content):
    assert set(content["en"]["ui"]) == set(content["ta"]["ui"])
    assert all(content["en"]["ui"].values()) and all(content["ta"]["ui"].values())
    assert shape(content["en"]["questions"]) == shape(content["ta"]["questions"])


def test_questions_cover_exactly_the_facts(content):
    ids = [q["id"] for q in content["en"]["questions"]]
    assert len(ids) == len(set(ids))
    assert set(ids) == set(Facts.model_fields)


def test_every_option_is_a_valid_fact(content):
    for q in content["en"]["questions"]:
        for option in q["options"] or []:
            Facts(**{q["id"]: option["value"]})


def test_every_choice_allows_not_knowing(content):
    for q in content["en"]["questions"]:
        if q["type"] != "number":
            assert "unknown" in [o["value"] for o in q["options"]], q["id"]


def test_district_list_is_complete(content):
    options = next(q for q in content["en"]["questions"] if q["id"] == "district")["options"]
    assert {o["value"] for o in options} == set(get_args(District))


def test_show_if_refers_to_earlier_answers(content):
    seen = {}
    for q in content["en"]["questions"]:
        for fact, values in (q["show_if"] or {}).items():
            assert fact in seen, f"{q['id']} depends on a later question"
            assert set(values) <= set(seen[fact])
        seen[q["id"]] = [o["value"] for o in q["options"] or []]


def test_unsupported_language_is_404(tmp_path):
    assert TestClient(create_app(tmp_path / "missing")).get("/api/content/hi").status_code == 404


def test_driver_is_asked_about_board_registration(content):
    question = next(q for q in content["en"]["questions"] if q["id"] == "husband_board_registered")
    assert "driver" in question["show_if"]["husband_work"]
