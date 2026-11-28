from pathlib import Path

import yaml

from app.contracts.scheme import Scheme

ORDER = ["destitute-widow-pension", "national-widow-pension", "national-family-benefit", "national-old-age-pension",
         "construction-board-death", "drivers-board-death", "manual-board-death", "pmjjby", "pmsby"]


def load_schemes(content_dir: Path) -> list[Scheme]:
    """Read every rule file. An invalid file raises, so a broken rule never reaches a person."""
    schemes = [Scheme.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
               for path in sorted(content_dir.glob("schemes/*/scheme.yaml"))]
    return sorted(schemes, key=lambda s: (ORDER.index(s.id) if s.id in ORDER else len(ORDER), s.id))
