from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException

from app.contracts.content import Content

LANGUAGES = ("en", "ta")


def load_lines(content_dir: Path) -> dict[str, Content]:
    # Read once at startup, so a broken file stops the app before anyone sees it.
    return {lang: Content.model_validate(yaml.safe_load((content_dir / "lines" / f"{lang}.yaml").read_text(encoding="utf-8")))
            for lang in LANGUAGES}


def router(lines: dict[str, Content]) -> APIRouter:
    api = APIRouter()

    @api.get("/api/content/{lang}")
    def content(lang: str) -> Content:
        if lang not in lines:
            raise HTTPException(404, "language not available yet")
        return lines[lang]

    return api
