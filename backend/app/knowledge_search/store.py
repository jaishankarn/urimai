"""Copy the repository's rules and search passages into PostgreSQL."""
import hashlib
import json
from pathlib import Path

from psycopg.types.json import Jsonb

from app.knowledge_search.text import normalise

SCHEMA = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
DATA_FILES = ("passages.jsonl", "vectors.npy", "manifest.json")


def data_version(search_dir: Path, schemes: list[dict]) -> str:
    digest = hashlib.sha256(json.dumps(schemes, sort_keys=True, ensure_ascii=False).encode())
    for name in DATA_FILES:
        path = search_dir / name
        if path.is_file():
            digest.update(name.encode() + hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def _passages(search_dir: Path) -> list[dict]:
    path = search_dir / "passages.jsonl"
    if not path.is_file():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def load(conn, search_dir: Path, schemes: list[dict]) -> bool:
    """Replace the tables when the files have changed. Returns False when they are already current.

    Runs in one transaction: a bad file leaves the previous data in place.
    """
    version = data_version(search_dir, schemes)
    with conn.transaction():
        conn.execute(SCHEMA)
        current = conn.execute("select value from meta where key = 'data_version'").fetchone()
        if current and current[0] == version:
            return False
        conn.execute("truncate passage_source, passage, document, scheme, meta restart identity cascade")
        for scheme in schemes:
            conn.execute("insert into scheme (id, record) values (%s, %s)", (scheme["id"], Jsonb(scheme)))
        documents: dict[str, int] = {}
        for passage in _passages(search_dir):
            search_text = normalise(passage["text"])
            conn.execute("insert into passage (id, text, search_text, content_hash) values (%s, %s, %s, %s)",
                         (passage["id"], passage["text"], search_text, hashlib.sha256(search_text.encode()).hexdigest()))
            for document in passage["documents"]:
                url = document["url"]
                if url not in documents:
                    documents[url] = conn.execute(
                        "insert into document (url, title, source_type, jurisdiction, source_date, language) "
                        "values (%(url)s, %(title)s, %(source_type)s, %(jurisdiction)s, %(source_date)s, %(language)s) returning id",
                        document).fetchone()[0]
                conn.execute("insert into passage_source (passage_id, document_id) values (%s, %s) on conflict do nothing",
                             (passage["id"], documents[url]))
        conn.execute("insert into meta (key, value) values ('data_version', %s)", (version,))
    return True
