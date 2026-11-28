"""The summary panel needs a short label for every question, in both languages."""
from pathlib import Path

from app.api.content import load_lines

PANEL = ["section_you", "section_husband", "section_household", "details_title", "details_empty", "details_count",
         "details_locked", "step_talk", "step_confirm", "step_schemes", "back_to_top",
         "assistant_title", "assistant_sub", "safety_note",
         "appearance", "mode_label", "close", "theme_lavender", "theme_mint", "theme_marigold", "theme_terracotta",
         "mode_auto", "mode_light", "mode_dark"]


def test_summary_panel_lines_exist_in_both_languages():
    for lang, content in load_lines(Path(__file__).parents[1] / "app" / "content").items():
        wanted = PANEL + [f"label_{question.id}" for question in content.questions]
        assert [key for key in wanted if not content.ui.get(key)] == [], lang
