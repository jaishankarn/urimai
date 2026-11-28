import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import content, eligibility
from app.knowledge_search.monitor import DatabaseMonitor
from app.scheme_library.loader import load_schemes

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
CONTENT_DIR = Path(__file__).resolve().parent / "content"
# Value shipped in .env.example; copying that file unchanged must not count as a key.
PLACEHOLDER_KEY = "your_sarvam_key_here"


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

    @app.get("/api/health")
    def health():
        key = os.environ.get("SARVAM_API_KEY", "").strip()
        # Always 200: the app works without the database, and says what is ready.
        return {"status": "ok", "sarvam_configured": key not in ("", PLACEHOLDER_KEY), "database": database.ready,
                "semantic_search": False, "data_version": database.data_version if database.ready else None}

    app.include_router(eligibility.router(schemes))
    app.include_router(content.router(content_dir))

    # Mounted last so /api routes win. Skipped when the frontend isn't built (local dev, tests).
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True))

    return app


app = create_app()
