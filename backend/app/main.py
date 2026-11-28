import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import content, conversation, eligibility, forms, voice, widget
from app.brain.speakable import Speakable
from app.forms.loader import load_forms
from app.handoff.store import Store
from app.knowledge_search.monitor import DatabaseMonitor
from app.portal.routes import router as portal_router
from app.portal.routes import static_files as portal_static
from app.scheme_library.loader import load_schemes
from app.voice.base import Voice, ai_provider
from app.voice.local_ai import LocalAI
from app.voice.sarvam import configured_key
from app.voice.widget_sarvam import SarvamVoice

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
WIDGET_DIR = Path(__file__).resolve().parent.parent / "widget_dist"
CONTENT_DIR = Path(__file__).resolve().parent / "content"


class WidgetFiles(StaticFiles):
    """The widget script: short cache during the hackathon, so fixes reach pages quickly."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=300"
        return response


def create_app(static_dir: Path = STATIC_DIR, content_dir: Path = CONTENT_DIR, widget_dir: Path = WIDGET_DIR,
               widget_voice: Voice | None = None, store: Store | None = None,
               portal_test_hooks: bool = False) -> FastAPI:
    schemes = load_schemes(content_dir)
    registry = load_forms(content_dir, {s.id for s in schemes})
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
                "semantic_search": False, "data_version": database.data_version if database.ready else None,
                "ai": ai_provider()}

    app.include_router(eligibility.router(schemes))
    lines = content.load_lines(content_dir)
    app.include_router(content.router(lines))
    speakable = Speakable(lines)
    app.include_router(voice.router(lines, speakable))
    app.include_router(conversation.router(schemes, lines, speakable))

    # Voice form widget, its handoff, and the practice portal.
    store = store or Store()
    app.include_router(forms.router(registry, store))
    app.include_router(widget.router(registry, store, widget_voice or SarvamVoice(ai=LocalAI() if ai_provider() == "local" else None)))
    app.add_middleware(widget.WidgetCors, origins={o for f in registry.forms.values() for o in f.site.origins if o != "self"})
    app.include_router(portal_router(test_hooks=portal_test_hooks))
    app.mount("/portal/static", portal_static(), name="portal-static")
    if widget_dir.is_dir():
        app.mount("/widget", WidgetFiles(directory=widget_dir), name="widget")

    # Mounted last so /api, /portal and /widget win. Skipped when the frontend isn't built (local dev, tests).
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True))

    return app


app = create_app()
