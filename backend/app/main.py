import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
# Value shipped in .env.example; copying that file unchanged must not count as a key.
PLACEHOLDER_KEY = "your_sarvam_key_here"


def create_app(static_dir: Path = STATIC_DIR) -> FastAPI:
    app = FastAPI(title="Urimai")

    @app.get("/api/health")
    def health():
        key = os.environ.get("SARVAM_API_KEY", "").strip()
        return {"status": "ok", "sarvam_configured": key not in ("", PLACEHOLDER_KEY)}

    # Mounted last so /api routes win. Skipped when the frontend isn't built (local dev, tests).
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True))

    return app


app = create_app()
