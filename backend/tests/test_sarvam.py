import base64
import json

import httpx2
import pytest

from app.voice.base import VoiceError
from app.voice.widget_sarvam import SarvamVoice


def adapter(handler, key="k-123"):
    client = httpx2.Client(base_url="https://api.sarvam.ai", transport=httpx2.MockTransport(handler))
    return SarvamVoice(key=lambda: key, client=client)


def test_listen_sends_multipart_with_mode_and_language():
    seen = {}

    def handler(request):
        seen["path"], seen["key"], seen["body"] = request.url.path, request.headers["api-subscription-key"], request.read()
        return httpx2.Response(200, json={"request_id": "r", "transcript": " ஆமாம் ", "language_code": "ta-IN"})

    assert adapter(handler).listen(b"audio", "audio/webm;codecs=opus", "ta", "codemix") == "ஆமாம்"
    assert seen["path"] == "/speech-to-text" and seen["key"] == "k-123"
    assert b'name="mode"' in seen["body"] and b"codemix" in seen["body"] and b"ta-IN" in seen["body"]
    assert b'filename="reply.webm"' in seen["body"]


def test_empty_transcript_is_unclear():
    with pytest.raises(VoiceError) as error:
        adapter(lambda r: httpx2.Response(200, json={"transcript": ""})).listen(b"a", "audio/webm", "ta", "codemix")
    assert error.value.kind == "unclear"


def test_speak_decodes_base64_audio():
    def handler(request):
        body = json.loads(request.read())
        assert body["language_code"] == "ta-IN" and body["model"] == "bulbul:v3" and body["output_audio_codec"] == "mp3"
        return httpx2.Response(200, json={"audios": [base64.b64encode(b"ID3abc").decode()]})

    assert adapter(handler).speak("வணக்கம்", "ta") == (b"ID3abc", "audio/mpeg")


def test_transliterate_and_chat():
    def handler(request):
        if request.url.path == "/transliterate":
            assert json.loads(request.read())["target_language_code"] == "en-IN"
            return httpx2.Response(200, json={"transliterated_text": "Selvi", "source_language_code": "ta-IN"})
        assert request.headers["authorization"] == "Bearer k-123"
        body = json.loads(request.read())
        assert body["response_format"]["type"] == "json_schema"
        return httpx2.Response(200, json={"choices": [{"message": {"content": '{"intent": "yes", "value": null}'}}]})

    voice = adapter(handler)
    assert voice.transliterate("செல்வி", "ta") == "Selvi"
    assert voice.chat_json("s", "u", {}) == {"intent": "yes", "value": None}


@pytest.mark.parametrize("status, code, kind", [(429, "rate_limit_exceeded_error", "quota"),
                                                (403, "invalid_api_key_error", "key_not_set"),
                                                (500, "internal_server_error", "provider")])
def test_errors_keep_only_the_code(status, code, kind):
    response = httpx2.Response(status, json={"error": {"message": "secret detail", "code": code}})
    with pytest.raises(VoiceError) as error:
        adapter(lambda r: response).speak("hi", "en")
    assert error.value.kind == kind and "secret detail" not in str(error.value)


def test_no_key_means_no_call():
    calls = []
    with pytest.raises(VoiceError) as error:
        adapter(lambda r: calls.append(r), key=None).speak("hi", "en")
    assert error.value.kind == "key_not_set" and calls == []


def test_local_model_answers_the_ai_step_without_calling_sarvam():
    from app.voice.local_ai import LocalAI

    def local(request):
        body = json.loads(request.read())
        assert request.url.path == "/v1/chat/completions" and body["response_format"]["type"] == "json_object"
        return httpx2.Response(200, json={"choices": [{"message": {"content": '{"intent": "value", "value": "58", "text": "Selvi"}'}}]})

    def sarvam(request):
        raise AssertionError("Sarvam must not be called for the AI step")

    ai = LocalAI("http://local:8080/v1", httpx2.Client(transport=httpx2.MockTransport(local)))
    voice = adapter(sarvam, key=None)
    voice._ai = ai
    assert voice.chat_json("s", "u", {})["value"] == "58"
    assert voice.transliterate("செல்வி", "ta") == "Selvi"


def test_local_model_down_is_a_plain_error():
    from app.voice.local_ai import LocalAI

    def down(request):
        raise httpx2.ConnectError("refused")

    with pytest.raises(VoiceError) as error:
        LocalAI("http://local:8080/v1", httpx2.Client(transport=httpx2.MockTransport(down))).chat_json("s", "u", {})
    assert error.value.kind == "provider"
