import time

from fastapi.testclient import TestClient

from app.main import create_app


def test_without_a_database_url(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with TestClient(create_app(tmp_path / "missing")) as client:
        health = client.get("/api/health").json()
    assert health["database"] is False and health["semantic_search"] is False and health["data_version"] is None


def test_unreachable_database_never_blocks_the_app(tmp_path, monkeypatch, demo):
    # Port 1 refuses connections.
    monkeypatch.setenv("DATABASE_URL", "postgresql://nobody:secret-word@127.0.0.1:1/none")
    started = time.monotonic()
    with TestClient(create_app(tmp_path / "missing")) as client:
        response = client.get("/api/health")
        assert response.status_code == 200 and response.json()["database"] is False
        assert "secret-word" not in response.text
        assert client.post("/api/eligibility", json=demo).status_code == 200
    assert time.monotonic() - started < 5
