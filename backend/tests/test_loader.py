import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.contracts.scheme import Scheme

KNOWLEDGE = Path(__file__).resolve().parents[2] / "data" / "knowledge"
ORDER = ["destitute-widow-pension", "national-widow-pension", "national-family-benefit", "national-old-age-pension",
         "construction-board-death", "drivers-board-death", "manual-board-death", "pmjjby", "pmsby"]


def squash(text):
    return re.sub(r"\s+", " ", text).strip()


def test_loads_all_rules_in_order(schemes):
    assert [s.id for s in schemes] == ORDER


def test_committed_rules_claim_no_government_order_check(schemes):
    assert not any(s.government_order_verified for s in schemes)


@pytest.mark.skipif(not KNOWLEDGE.is_dir(), reason="the collected documents are kept on one machine only")
def test_every_quote_is_in_its_source(schemes):
    missing = [f"{s.id}:{src.id}" for s in schemes for src in s.sources
               if src.local_file and squash(src.quote) not in squash((KNOWLEDGE / src.local_file).read_text(encoding="utf-8"))]
    assert missing == []


def test_every_rule_names_aliases_and_sources(schemes):
    assert all(len(s.aliases) >= 2 and s.sources and all(src.local_file and src.url.startswith("https://") for src in s.sources)
               for s in schemes)


def broken(schemes, change):
    data = schemes[0].model_dump()
    change(data)
    with pytest.raises(ValidationError):
        Scheme.model_validate(data)


def test_bad_source_reference_is_rejected(schemes):
    broken(schemes, lambda d: d["conditions"][0].update(source="nowhere"))


def test_unknown_fact_is_rejected(schemes):
    broken(schemes, lambda d: d["conditions"][0]["any_of"][0][0].update(fact="aadhaar_number"))


@pytest.mark.parametrize("value", [True, "yess"])
def test_bad_clause_value_is_rejected(schemes, value):
    # True is what an unquoted yes becomes in YAML
    broken(schemes, lambda d: d["conditions"][0]["any_of"][0][0].update(value=value))
