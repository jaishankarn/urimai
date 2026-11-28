"""Backend for the end-to-end tests. Usage: server.py <widget_dir> <port> <nokey|fakevoice> [frontend_dist]

- nokey: the real Sarvam adapter with no key, as graders run it.
- fakevoice: a stand-in for Sarvam (no network, no key needed) so the microphone path can be tested; the test
  queues what the "person said" with POST /_test/transcript.
Both add a test-only site with checks the widget does not know about (fixture_site.py).
"""
import shutil
import sys
import tempfile
from pathlib import Path

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here.parents[2] / "backend"))
sys.path.insert(0, str(here))

import os  # noqa: E402

import uvicorn  # noqa: E402
from fastapi import Body  # noqa: E402

from app.main import CONTENT_DIR, create_app  # noqa: E402
from app.voice.base import VoiceError  # noqa: E402
import fixture_site  # noqa: E402

widget_dir, port, mode = Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
static = Path(sys.argv[4]) if len(sys.argv) > 4 else Path("/nonexistent")

# 44-byte header of an empty WAV file: plays as silence.
SILENT_WAV = (b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00"
              b"data\x00\x00\x00\x00")


class FakeVoice:
    def __init__(self):
        self.queue: list[str] = []

    def listen(self, audio, content_type, lang, mode):
        if not self.queue:
            raise VoiceError("unclear")
        return self.queue.pop(0)

    def speak(self, text, lang):
        return SILENT_WAV, "audio/wav"

    def transliterate(self, text, lang):
        return {"செல்வி முருகன்": "Selvi Murugan"}.get(text.strip(), "Test")

    def chat_json(self, system, user, schema):
        return {"intent": "unclear", "value": None}


content = Path(tempfile.mkdtemp()) / "content"
shutil.copytree(CONTENT_DIR, content)
(content / "forms" / "fixture-odd-form.yaml").write_text(fixture_site.FORM_MAP, encoding="utf-8")

voice = FakeVoice() if mode == "fakevoice" else None
os.environ["SARVAM_API_KEY"] = "fake-key-for-tests" if mode == "fakevoice" else ""
app = create_app(static_dir=static, content_dir=content, widget_dir=widget_dir, widget_voice=voice, portal_test_hooks=True)

extra = fixture_site.router()
if voice:
    @extra.post("/_test/transcript")
    def transcript(text: str = Body(..., embed=True)):
        voice.queue.append(text)
        return {"queued": len(voice.queue)}
# In front of the website's catch-all static mount.
app.router.routes[:0] = extra.routes
uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
