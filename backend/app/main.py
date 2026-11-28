import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import content, conversation, eligibility, voice
from app.brain.speakable import Speakable
from app.knowledge_search.monitor import DatabaseMonitor
from app.scheme_library.loader import load_schemes
from app.voice.sarvam import configured_key

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
CONTENT_DIR = Path(__file__).resolve().parent / "content"


def create_app(static_dir: Path = STATIC_DIR, content_dir: Path = CONTENT_DIR) -> FastAPI:
    schemes = load_schemes(content_dir)
    database = DatabaseMonitor(os.environ.get("DATABASE_URL"), content_dir / "search",
                               [s.model_dump(mode="json") for s in schemes])

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        database.start()
        yield
        database.stop()

    app = FastAPI(title="Urimai", lifespan=lifespan)

    @app.middleware("http")
    async def check_page_for_updates(request, call_next):
        response = await call_next(request)
        # The page names the current script and style files; those names change with every build, so only it needs checking.
        if response.headers.get("content-type", "").startswith("text/html"):
            response.headers["cache-control"] = "no-cache"
        return response

    @app.get("/api/health")
    def health():
        # Always 200: the app works without the database or a key, and says what is ready.
        return {"status": "ok", "sarvam_configured": configured_key() is not None, "database": database.ready,
                "semantic_search": False, "data_version": database.data_version if database.ready else None}

    app.include_router(eligibility.router(schemes))
    lines = content.load_lines(content_dir)
    app.include_router(content.router(lines))
    speakable = Speakable(lines)
    app.include_router(voice.router(lines, speakable))
    app.include_router(conversation.router(schemes, lines, speakable))

    # Mounted last so /api routes win. Skipped when the frontend isn't built (local dev, tests).
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True))

    return app


app = create_app()
