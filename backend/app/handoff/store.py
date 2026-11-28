"""One-time handoff codes and widget sessions, in memory with expiry. Nothing is written to disk or logs.

A server restart loses them; the widget then says the link expired and offers to fill without carried values.
"""
import secrets
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from app.contracts.facts import Facts

CODE_TTL = 10 * 60
SESSION_TTL = 60 * 60
SESSION_IDLE = 30 * 60
# Per session, to protect the voice credits.
QUOTAS = {"listen": 60, "speak": 150, "understand": 80, "transliterate": 30}


@dataclass
class Handoff:
    form_id: str
    lang: str
    facts: Facts
    expires_at: float


@dataclass
class Session:
    form_id: str
    site_key: str
    lang: str
    expires_at: float
    last_used: float
    used: dict[str, int] = field(default_factory=dict)


class Store:
    def __init__(self, clock: Callable[[], float] = time.time):
        self._clock = clock
        self._lock = threading.Lock()
        self._codes: dict[str, Handoff] = {}
        self._sessions: dict[str, Session] = {}

    def _purge(self, now: float) -> None:
        self._codes = {k: v for k, v in self._codes.items() if v.expires_at > now}
        self._sessions = {k: v for k, v in self._sessions.items()
                          if v.expires_at > now and v.last_used + SESSION_IDLE > now}

    def create_code(self, form_id: str, lang: str, facts: Facts) -> str:
        code = secrets.token_urlsafe(16)
        with self._lock:
            now = self._clock()
            self._purge(now)
            self._codes[code] = Handoff(form_id, lang, facts, now + CODE_TTL)
        return code

    def take_code(self, code: str) -> Handoff | None:
        """Single use: the code is gone after this, whether or not the caller accepts it."""
        with self._lock:
            self._purge(self._clock())
            return self._codes.pop(code, None)

    def create_session(self, form_id: str, site_key: str, lang: str) -> tuple[str, float]:
        token = secrets.token_urlsafe(24)
        with self._lock:
            now = self._clock()
            self._purge(now)
            self._sessions[token] = Session(form_id, site_key, lang, now + SESSION_TTL, now)
            return token, now + SESSION_TTL

    def use(self, token: str, action: str | None = None) -> Session | None | str:
        """Return the live session, None if unknown or expired, or "quota" if the action's quota is spent."""
        with self._lock:
            now = self._clock()
            self._purge(now)
            session = self._sessions.get(token)
            if session is None:
                return None
            session.last_used = now
            if action:
                if session.used.get(action, 0) >= QUOTAS[action]:
                    return "quota"
                session.used[action] = session.used.get(action, 0) + 1
            return session

    def end(self, token: str) -> None:
        with self._lock:
            self._sessions.pop(token, None)


class RateLimit:
    """A simple fixed-window limit per key (client address)."""

    def __init__(self, limit: int, window: float, clock: Callable[[], float] = time.time):
        self.limit, self.window, self._clock = limit, window, clock
        self._lock = threading.Lock()
        self._hits: dict[str, list[float]] = {}

    def allow(self, key: str) -> bool:
        with self._lock:
            now = self._clock()
            hits = [t for t in self._hits.get(key, []) if t > now - self.window]
            if len(hits) >= self.limit:
                self._hits[key] = hits
                return False
            self._hits[key] = [*hits, now]
            if len(self._hits) > 10_000:
                self._hits = {k: v for k, v in self._hits.items() if v and v[-1] > now - self.window}
            return True
