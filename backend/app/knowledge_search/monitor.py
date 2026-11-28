"""Keeps the database loaded from a background thread, so that no request ever waits for it."""
import logging
import threading
import time
from pathlib import Path

import psycopg

from app.knowledge_search.store import data_version, load

log = logging.getLogger("uvicorn.error")
EVERY_SECONDS = 3
STALE_AFTER_SECONDS = 10  # also covers a connection that hangs without failing


class DatabaseMonitor:
    def __init__(self, url: str | None, search_dir: Path, schemes: list[dict]):
        self.url, self.search_dir, self.schemes = url, search_dir, schemes
        self.data_version: str | None = None
        self._last_ok: float | None = None
        self._stop = threading.Event()

    @property
    def ready(self) -> bool:
        return self._last_ok is not None and time.monotonic() - self._last_ok < STALE_AFTER_SECONDS

    def start(self) -> None:
        if self.url:
            self._stop.clear()
            threading.Thread(target=self._run, daemon=True, name="database-monitor").start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        reported = None
        while not self._stop.is_set():
            try:
                with psycopg.connect(self.url, autocommit=True, connect_timeout=3) as conn:
                    load(conn, self.search_dir, self.schemes)
                    self.data_version = data_version(self.search_dir, self.schemes)
                    while not self._stop.is_set():
                        conn.execute("select 1")
                        self._last_ok = time.monotonic()
                        if reported != "ready":
                            log.info("database ready")
                            reported = "ready"
                        self._stop.wait(EVERY_SECONDS)
            except Exception as error:  # any failure: report, wait, try again. The app keeps serving.
                self._last_ok = None
                self.data_version = None
                # Only the error type: a message can contain the connection string.
                if reported != type(error).__name__:
                    log.warning("database not available (%s); retrying", type(error).__name__)
                    reported = type(error).__name__
                self._stop.wait(EVERY_SECONDS)
