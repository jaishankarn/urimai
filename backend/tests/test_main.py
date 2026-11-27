import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.mark.parametrize(
    "value, configured",
    [(None, False), ("", False), ("   ", False), ("your_sarvam_key_here", False), ("test-secret-123", True)],
)
def test_health_reports_key_without_leaking_it(monkeypatch, tmp_path, value, configured):
    if value is None:
        monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    else:
        monkeypatch.setenv("SARVAM_API_KEY", value)
    response = TestClient(create_app(tmp_path / "missing")).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "sarvam_configured": configured}
    assert "test-secret-123" not in response.text


def test_serves_built_frontend_beside_api(tmp_path):
    (tmp_path / "index.html").write_text("<title>Urimai</title>")
    client = TestClient(create_app(tmp_path))
    assert "<title>Urimai</title>" in client.get("/").text
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/unknown").status_code == 404
