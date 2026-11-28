import json

import pytest
from fastapi.testclient import TestClient

from app.api import voice as voice_api
from app.main import create_app


class FakeSarvam:
    def __init__(self):
        self.calls = []

    def transcribe(self, audio, content_type, lang):
        self.calls.append(("stt", content_type, lang, len(audio)))
        return "I am 58"

    def speak(self, text, lang):
        self.calls.append(("tts", text, lang))
        return b"RIFFfake"

    def chat_json(self, system, user):
        return json.dumps({"facts": [{"key": "age", "value": 58, "quote": "I am 58"}]})


@pytest.fixture
def fake(monkeypatch):
    sarvam = FakeSarvam()
    monkeypatch.setenv("SARVAM_API_KEY", "test-key-value")
    monkeypatch.setattr(voice_api, "make_client", lambda key: sarvam)
    return sarvam


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(tmp_path / "missing"))


def stt(client, body=b"x" * 100, kind="audio/webm;codecs=opus", lang="ta"):
    return client.post(f"/api/voice/stt?lang={lang}", content=body, headers={"Content-Type": kind})


def test_speech_to_text_accepts_browser_audio(fake, client):
    assert stt(client).json() == {"text": "I am 58"}
    assert fake.calls == [("stt", "audio/webm", "ta", 100)]


@pytest.mark.parametrize("kwargs, status", [
    (dict(body=b""), 422), (dict(body=b"x" * 5_000_001), 413), (dict(kind="text/plain"), 415), (dict(lang="hi"), 422)])
def test_speech_to_text_rejects_bad_input(fake, client, kwargs, status):
    assert stt(client, **kwargs).status_code == status and fake.calls == []


def test_text_to_speech_returns_audio_and_caches_it(fake, client):
    for _ in range(2):
        response = client.post("/api/voice/tts", json={"lang": "en", "text": "Hello"})
        assert response.content == b"RIFFfake" and response.headers["content-type"] == "audio/wav"
    assert len(fake.calls) == 1


@pytest.mark.parametrize("body", [{"lang": "en", "text": ""}, {"lang": "en", "text": "x" * 1201}, {"lang": "fr", "text": "a"}])
def test_text_to_speech_limits(fake, client, body):
    assert client.post("/api/voice/tts", json=body).status_code == 422


def test_understand_returns_checked_facts(fake, client):
    response = client.post("/api/conversation/understand", json={"lang": "en", "text": "I am 58", "question_id": None})
    assert response.json() == {"facts": {"age": 58}, "dont_know": False}


def test_understand_rejects_an_unknown_question(fake, client):
    assert client.post("/api/conversation/understand", json={"lang": "en", "text": "a", "question_id": "aadhaar"}).status_code == 422


@pytest.mark.parametrize("value", ["", "your_sarvam_key_here"])
def test_without_a_key_voice_says_so(monkeypatch, client, value):
    monkeypatch.setenv("SARVAM_API_KEY", value)
    for response in (stt(client), client.post("/api/voice/tts", json={"lang": "en", "text": "a"}),
                     client.post("/api/conversation/understand", json={"lang": "en", "text": "a"})):
        assert response.status_code == 503 and response.json()["detail"] == "Sarvam key not set"


def test_a_sarvam_failure_leaks_nothing(fake, client, caplog):
    def broken(*args):
        raise RuntimeError("test-key-value said: I am 58")
    fake.transcribe = broken
    response = stt(client)
    assert response.status_code == 502 and "test-key-value" not in response.text
    assert "test-key-value" not in caplog.text and "I am 58" not in caplog.text


def test_paid_routes_are_rate_limited(fake, client):
    codes = [stt(client).status_code for _ in range(voice_api.CALLS_PER_MINUTE + 1)]
    assert codes[-1] == 429 and set(codes[:-1]) == {200}
