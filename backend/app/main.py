from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import content, conversation, eligibility, voice
from app.scheme_library.loader import load_schemes
from app.voice.sarvam import configured_key

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
CONTENT_DIR = Path(__file__).resolve().parent / "content"


def create_app(static_dir: Path = STATIC_DIR, content_dir: Path = CONTENT_DIR) -> FastAPI:
    app = FastAPI(title="Urimai")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "sarvam_configured": configured_key() is not None}

    schemes = load_schemes(content_dir)
    app.include_router(eligibility.router(schemes))
    lines = content.load_lines(content_dir)
    app.include_router(content.router(lines))
    app.include_router(voice.router(lines))
    app.include_router(conversation.router(schemes, lines))

    # Mounted last so /api routes win. Skipped when the frontend isn't built (local dev, tests).
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True))

    return app


app = create_app()
