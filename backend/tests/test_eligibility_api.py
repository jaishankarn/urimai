from fastapi.testclient import TestClient

from app.main import create_app


def client(tmp_path):
    return TestClient(create_app(tmp_path / "missing"))


def test_returns_all_rules(tmp_path, demo):
    response = client(tmp_path).post("/api/eligibility", json=demo)
    assert response.status_code == 200
    found = response.json()["results"]
    assert len(found) == 8
    assert all("local_file" not in source for r in found for source in r["sources"])


def test_unreviewed_rules_never_say_eligible(tmp_path, demo, schemes):
    pending = {s.id for s in schemes if not s.reviewed}
    found = client(tmp_path).post("/api/eligibility", json=demo).json()["results"]
    assert all(r["outcome"] == "needs_more_information" for r in found if r["scheme_id"] in pending)


def test_unexpected_field_is_rejected(tmp_path):
    assert client(tmp_path).post("/api/eligibility", json={"aadhaar": "x"}).status_code == 422


def test_no_facts_is_allowed(tmp_path):
    assert client(tmp_path).post("/api/eligibility", json={}).status_code == 200
