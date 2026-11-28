import logging

import pytest
from fastapi.testclient import TestClient

from app.handoff.store import QUOTAS, Store
from app.main import create_app
from app.voice.base import VoiceError

SITE = "urimai-practice"
FORM = "demo-destitute-widow-pension"


class FakeVoice:
    def __init__(self):
        self.calls = []

    def listen(self, audio, content_type, lang, mode):
        self.calls.append(("listen", content_type, lang, mode))
        return "ஆமாம்"

    def speak(self, text, lang):
        self.calls.append(("speak", text, lang))
        return b"ID3fake", "audio/mpeg"

    def transliterate(self, text, lang):
        self.calls.append(("transliterate", text))
        return "Selvi"

    def chat_json(self, system, user, schema):
        self.calls.append(("chat", user))
        return {"intent": "value", "value": "58"}


class Clock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def voice():
    return FakeVoice()


@pytest.fixture
def client(tmp_path, voice, clock, monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    return TestClient(create_app(tmp_path / "missing", widget_voice=voice, store=Store(clock)))


def handoff(client, facts=None, lang="ta"):
    response = client.post("/api/handoff", json={"form_id": FORM, "lang": lang,
                                                 "facts": facts or {"age": 58, "widowed": "yes", "district": "madurai"}})
    assert response.status_code == 200
    return response.json()["url"].split("#urimai=")[1]


def session(client, code=None, **headers):
    return client.post("/api/widget/session", json={"site_key": SITE, "code": code}, headers=headers)


def token(client):
    return {"Authorization": "Bearer " + session(client).json()["token"]}


def test_forms_are_listed_by_scheme(client):
    assert client.get("/api/forms", params={"scheme_id": "destitute-widow-pension"}).json()[0]["form_id"] == FORM
    assert client.get("/api/forms", params={"scheme_id": "pmsby"}).json() == []


def test_handoff_url_points_at_the_form_with_a_fragment(client):
    response = client.post("/api/handoff", json={"form_id": FORM, "lang": "en", "facts": {}})
    assert response.json()["url"].startswith("/portal/pension/apply#urimai=")


def test_handoff_refuses_other_origins_and_unknown_forms(client):
    body = {"form_id": FORM, "lang": "en", "facts": {}}
    assert client.post("/api/handoff", json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/handoff", json={**body, "form_id": "nope"}).status_code == 404
    assert client.post("/api/handoff", json={**body, "facts": {"aadhaar": "1"}}).status_code == 422


def test_code_gives_a_plan_with_carried_values_once(client):
    code = handoff(client)
    plan = session(client, code).json()
    values = {f["key"]: f["value"] for f in plan["fields"]}
    assert plan["carried"] and plan["lang"] == "ta"
    assert values["age"] == "58" and values["marital"] == "Widow" and values["district"] == "madurai"
    assert all(f["value"] is None for f in plan["fields"] if f["mode"] in ("user", "next", "submit"))
    assert set(plan["lines"]) == {"en", "ta"} and plan["voice"]["listen"] is False
    assert "map" not in plan["fields"][0]
    assert session(client, code).json() == {"error": "code_expired"}


def test_unknown_and_unmapped_facts_are_asked(client):
    plan = session(client, handoff(client, {"widowed": "no", "district": "unknown"})).json()
    values = {f["key"]: f["value"] for f in plan["fields"]}
    assert values["marital"] is None and values["district"] is None and values["age"] is None


def test_expired_code(client, clock):
    code = handoff(client)
    clock.now += 11 * 60
    assert session(client, code).status_code == 410


def test_code_for_another_site_or_unknown_site(client):
    code = handoff(client)
    assert client.post("/api/widget/session", json={"site_key": "other", "code": code}).status_code == 404


def test_session_without_code_asks_everything(client):
    plan = session(client).json()
    assert not plan["carried"] and all(f["value"] is None for f in plan["fields"])


def test_origin_must_be_registered(client):
    assert session(client, Origin="https://evil.example").json() == {"error": "origin_not_registered"}
    assert session(client, Origin="http://testserver").status_code == 200  # "self"


def test_session_rate_limit(client):
    statuses = [session(client).status_code for _ in range(31)]
    assert statuses[-1] == 429 and statuses[0] == 200


def test_voice_routes_need_a_live_session(client, clock):
    assert client.post("/api/widget/speak", json={"text": "hi", "lang": "ta"}).status_code == 401
    headers = token(client)
    clock.now += 31 * 60  # idle timeout
    assert client.post("/api/widget/speak", json={"text": "hi", "lang": "ta"}, headers=headers).status_code == 401


def test_speak_and_listen_with_fake_voice(client, voice):
    headers = token(client)
    audio = client.post("/api/widget/speak", json={"text": "வணக்கம்", "lang": "ta"}, headers=headers)
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"
    client.post("/api/widget/speak", json={"text": "வணக்கம்", "lang": "ta"}, headers=headers)
    assert [c[0] for c in voice.calls] == ["speak"]  # second time from cache
    heard = client.post("/api/widget/listen", files={"audio": ("a.webm", b"x" * 2000, "audio/webm")},
                        data={"lang": "ta", "mode": "codemix"}, headers=headers)
    assert heard.json() == {"text": "ஆமாம்"}
    assert voice.calls[-1] == ("listen", "audio/webm", "ta", "codemix")


def test_listen_rejects_silence_and_huge_audio(client):
    headers = token(client)
    assert client.post("/api/widget/listen", files={"audio": ("a.webm", b"x", "audio/webm")},
                       headers=headers).json() == {"error": "unclear"}
    big = b"x" * (2 * 1024 * 1024 + 10)
    assert client.post("/api/widget/listen", files={"audio": ("a.webm", big, "audio/webm")},
                       headers=headers).status_code == 413


def test_key_not_set_from_the_real_adapter(tmp_path, monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    client = TestClient(create_app(tmp_path / "missing"))
    headers = token(client)
    response = client.post("/api/widget/speak", json={"text": "hi", "lang": "en"}, headers=headers)
    assert response.status_code == 503 and response.json() == {"error": "key_not_set"}


def test_quota(client):
    headers = token(client)
    for n in range(QUOTAS["transliterate"]):
        assert client.post("/api/widget/transliterate", json={"text": f"செல்வி {n}"}, headers=headers).status_code == 200
    assert client.post("/api/widget/transliterate", json={"text": "x"}, headers=headers).json() == {"error": "quota"}


def understand(client, headers, utterance, expecting="value", kind="digits"):
    return client.post("/api/widget/understand", headers=headers, json={
        "field": {"key": "age", "kind": kind, "label": "Age"}, "expecting": expecting, "utterance": utterance,
        "lang": "ta"}).json()


def test_understand_uses_rules_without_key(client, voice):
    headers = token(client)
    assert understand(client, headers, "ஆமாம்", "confirm")["intent"] == "yes"
    assert understand(client, headers, "ஐம்பத்தெட்டு")["intent"] == "unclear"
    assert not [c for c in voice.calls if c[0] == "chat"]


def test_understand_falls_back_to_ai_with_key(client, voice, monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "test-key")
    headers = token(client)
    result = understand(client, headers, "ஐம்பத்தெட்டு")
    assert result == {"intent": "value", "value": "58", "by": "ai", "problem": None}
    assert understand(client, headers, "58")["by"] == "rules"
    assert len([c for c in voice.calls if c[0] == "chat"]) == 1


def test_end_session(client):
    headers = token(client)
    client.post("/api/widget/end", headers=headers)
    assert client.post("/api/widget/transliterate", json={"text": "x"}, headers=headers).status_code == 401


def test_no_personal_values_in_logs(client, caplog):
    caplog.set_level(logging.DEBUG)
    code = handoff(client, {"age": 58, "district": "madurai", "widowed": "yes"})
    headers = {"Authorization": "Bearer " + session(client, code).json()["token"]}
    understand(client, headers, "9876543210", kind="mobile")
    assert "9876543210" not in caplog.text and code not in caplog.text


def test_cross_origin_preflight_only_for_registered_origins(tmp_path, monkeypatch):
    import shutil
    from app.main import CONTENT_DIR
    content = tmp_path / "content"
    shutil.copytree(CONTENT_DIR, content)
    form = content / "forms" / f"{FORM}.yaml"
    form.write_text(form.read_text(encoding="utf-8").replace("origins: [self]",
                                                             "origins: [self, \"http://localhost:5174\"]"))
    client = TestClient(create_app(tmp_path / "missing", content_dir=content, widget_voice=FakeVoice()))
    good = client.options("/api/widget/session", headers={"Origin": "http://localhost:5174",
                                                          "Access-Control-Request-Method": "POST"})
    assert good.status_code == 204 and good.headers["access-control-allow-origin"] == "http://localhost:5174"
    bad = client.options("/api/widget/session", headers={"Origin": "https://evil.example",
                                                         "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers
    ok = client.post("/api/widget/session", json={"site_key": SITE}, headers={"Origin": "http://localhost:5174"})
    assert ok.status_code == 200 and ok.headers["access-control-allow-origin"] == "http://localhost:5174"


def test_demo_handoff_redirects_with_sample_details(client):
    response = client.get("/api/demo/handoff", params={"form_id": FORM, "lang": "en"}, follow_redirects=False)
    assert response.status_code == 303
    plan = session(client, response.headers["location"].split("#urimai=")[1]).json()
    assert plan["lang"] == "en" and {f["key"]: f["value"] for f in plan["fields"]}["age"] == "58"


def test_voice_errors_map_to_plain_codes(client, voice):
    def broken(*args):
        raise VoiceError("quota", "insufficient_quota_error")
    voice.speak = broken
    response = client.post("/api/widget/speak", json={"text": "new", "lang": "ta"}, headers=token(client))
    assert response.json() == {"error": "voice_paused"}


def test_local_ai_makes_understanding_available_without_a_key(tmp_path, voice, monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    monkeypatch.setenv("AI_PROVIDER", "local")
    client = TestClient(create_app(tmp_path / "missing", widget_voice=voice))
    plan = session(client).json()
    assert plan["voice"] == {"listen": False, "speak": False, "understand": True, "transliterate": True}
    headers = {"Authorization": "Bearer " + plan["token"]}
    assert understand(client, headers, "ஐம்பத்தெட்டு")["by"] == "ai"
