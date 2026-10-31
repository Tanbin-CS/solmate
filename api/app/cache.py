"""Result cache: Firestore `aoi_cache` in production, in-memory dict otherwise."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
from typing import Protocol

TTL_DAYS = 30


def cache_key(lat: float, lon: float, size_km: float, model_version: str) -> str:
    raw = json.dumps([round(lat, 2), round(lon, 2), round(size_km, 1), model_version])
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class Cache(Protocol):
    def get(self, key: str) -> dict | None: ...
    def put(self, key: str, value: dict) -> None: ...


class MemoryCache:
    def __init__(self) -> None:
        self._d: dict[str, dict] = {}

    def get(self, key: str) -> dict | None:
        return self._d.get(key)

    def put(self, key: str, value: dict) -> None:
        self._d[key] = value


class FirestoreCache:
    """Collection aoi_cache; documents expire through a Firestore TTL policy on `expireAt`."""

    def __init__(self, project: str) -> None:
        from google.cloud import firestore

        self._col = firestore.Client(project=project).collection("aoi_cache")

    def get(self, key: str) -> dict | None:
        snap = self._col.document(key).get()
        return (snap.to_dict() or {}).get("value") if snap.exists else None

    def put(self, key: str, value: dict) -> None:
        expire = dt.datetime.now(dt.UTC) + dt.timedelta(days=TTL_DAYS)
        self._col.document(key).set({"value": value, "expireAt": expire})
