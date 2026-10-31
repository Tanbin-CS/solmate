"""App Check verification, per-client rate limiting and client-IP hashing."""

from __future__ import annotations

import hashlib
import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request

APP_CHECK_HEADER = "X-Firebase-AppCheck"


def verify_app_check(request: Request, required: bool) -> None:
    """Reject requests without a valid Firebase App Check token (401). Generic error text only."""
    if not required:
        return
    token = request.headers.get(APP_CHECK_HEADER)
    if not token:
        raise HTTPException(status_code=401, detail="missing app attestation")
    try:
        from firebase_admin import app_check

        _ensure_firebase()
        app_check.verify_token(token)
    except Exception:  # noqa: BLE001 - never echo token or verifier details
        raise HTTPException(status_code=401, detail="invalid app attestation") from None


_firebase_lock = threading.Lock()


def _ensure_firebase() -> None:
    import firebase_admin

    with _firebase_lock:
        if not firebase_admin._apps:  # noqa: SLF001 - documented way to check initialisation
            firebase_admin.initialize_app()


def client_key(request: Request) -> str:
    """Salted hash of the client address; raw IPs are never stored or logged."""
    fwd = request.headers.get("X-Forwarded-For", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
    return hashlib.sha256(f"solmate:{ip}".encode()).hexdigest()[:16]


class RateLimiter:
    """Sliding one-minute window per client key, in memory (per instance; max 2 instances)."""

    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str, now: float | None = None) -> None:
        t = time.monotonic() if now is None else now
        with self._lock:
            hits = [h for h in self._hits[key] if t - h < 60.0]
            if len(hits) >= self.per_minute:
                self._hits[key] = hits
                raise HTTPException(status_code=429, detail="too many requests, try again in a minute")
            hits.append(t)
            self._hits[key] = hits
