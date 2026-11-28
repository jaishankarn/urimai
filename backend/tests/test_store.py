"""Loader tests against a real PostgreSQL. Set TEST_DATABASE_URL to a throwaway database: its tables are dropped."""
import os
import shutil
from pathlib import Path

import pytest

URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="TEST_DATABASE_URL is not set")
SEED = Path(__file__).parent / "fixtures" / "seed"
TABLES = ["passage_source", "passage", "document", "scheme", "meta"]


@pytest.fixture
def conn():
    import psycopg

    with psycopg.connect(URL, autocommit=True) as connection:
        connection.execute(f"drop table if exists {', '.join(TABLES)} cascade")
        yield connection


@pytest.fixture
def seed(tmp_path):
    return Path(shutil.copytree(SEED, tmp_path / "seed"))


@pytest.fixture
def rules(schemes):
    return [s.model_dump(mode="json") for s in schemes]


def counts(conn):
    return {t: conn.execute(f"select count(*) from {t}").fetchone()[0] for t in TABLES if t != "meta"}


def test_first_load_then_no_change(conn, seed, rules):
    from app.knowledge_search.store import load

    assert load(conn, seed, rules) is True
    first = counts(conn)
    assert first == {"passage_source": 4, "passage": 3, "document": 3, "scheme": len(rules)}
    assert load(conn, seed, rules) is False
    assert counts(conn) == first


def test_changed_data_replaces_without_duplicates(conn, seed, rules):
    from app.knowledge_search.store import data_version, load

    load(conn, seed, rules)
    before = data_version(seed, rules)
    path = seed / "passages.jsonl"
    path.write_text(path.read_text().replace("Rs.50,000", "Rs.55,000"))
    assert data_version(seed, rules) != before
    assert load(conn, seed, rules) is True
    assert counts(conn)["passage"] == 3
    assert conn.execute("select count(*) from passage where text like '%55,000%'").fetchone()[0] == 1


def test_a_bad_file_keeps_the_previous_data(conn, seed, rules):
    from app.knowledge_search.store import load

    load(conn, seed, rules)
    (seed / "passages.jsonl").write_text("not json\n")
    with pytest.raises(ValueError):
        load(conn, seed, rules)
    assert counts(conn)["passage"] == 3


def test_search_text_is_normalised_and_shown_text_is_not(conn, seed, rules):
    from app.knowledge_search.store import load

    line = '{"id": 9, "text": "அவா்  திட்டம்", "documents": []}\n'
    (seed / "passages.jsonl").write_text(line)
    load(conn, seed, rules)
    assert conn.execute("select text, search_text from passage").fetchone() == ("அவா்  திட்டம்", "அவர் திட்டம்")


def test_missing_search_folder_loads_rules_only(conn, tmp_path, rules):
    from app.knowledge_search.store import load

    assert load(conn, tmp_path / "none", rules) is True
    assert counts(conn)["passage"] == 0 and counts(conn)["scheme"] == len(rules)
