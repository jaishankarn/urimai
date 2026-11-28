"""Loads and checks the form maps and widget lines once, at startup."""
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from app.contracts.forms import FormMap

LANGUAGES = ("en", "ta")
PLACEHOLDER = re.compile(r"\{(\w+)\}")


@dataclass(frozen=True)
class FormRegistry:
    forms: dict[str, FormMap]
    lines: dict[str, dict[str, str]]

    def for_scheme(self, scheme_id: str) -> list[FormMap]:
        return [f for f in self.forms.values() if f.scheme_id == scheme_id]

    def for_site(self, site_key: str) -> list[FormMap]:
        return [f for f in self.forms.values() if f.site.key == site_key]


def load_forms(content_dir: Path, scheme_ids: set[str]) -> FormRegistry:
    """Read every form map. An invalid map raises, so a broken map never reaches a page."""
    forms: dict[str, FormMap] = {}
    for path in sorted(content_dir.glob("forms/*.yaml")):
        form = FormMap.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
        if form.id != path.stem:
            raise ValueError(f"{path.name}: id {form.id!r} must match the file name")
        if form.scheme_id not in scheme_ids:
            raise ValueError(f"{form.id}: unknown scheme {form.scheme_id!r}")
        forms[form.id] = form
    sites: dict[str, list[str]] = {}
    for form in forms.values():
        sites.setdefault(form.site.key, []).append(form.id)
    if shared := {k: v for k, v in sites.items() if len(v) > 1}:
        # One site key = one form for now: the widget picks its plan by site key.
        raise ValueError(f"site keys used by more than one form: {shared}")
    return FormRegistry(forms=forms, lines=load_widget_lines(content_dir))


def load_widget_lines(content_dir: Path) -> dict[str, dict[str, str]]:
    lines = {}
    for lang in LANGUAGES:
        raw = yaml.safe_load((content_dir / "lines" / f"widget.{lang}.yaml").read_text(encoding="utf-8"))
        if not isinstance(raw, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in raw.items()):
            raise ValueError(f"widget.{lang}.yaml must map names to text")
        lines[lang] = raw
    base = lines[LANGUAGES[0]]
    for lang in LANGUAGES[1:]:
        if set(lines[lang]) != set(base):
            raise ValueError(f"widget lines differ: {sorted(set(lines[lang]) ^ set(base))}")
        for key, text in base.items():
            if set(PLACEHOLDER.findall(text)) != set(PLACEHOLDER.findall(lines[lang][key])):
                raise ValueError(f"widget line {key!r}: placeholders differ between en and {lang}")
    return lines
