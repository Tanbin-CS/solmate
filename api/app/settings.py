"""Runtime configuration from environment variables (no secrets in code)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    offline: bool = field(default_factory=lambda: os.environ.get("OFFLINE", "0") == "1")
    require_app_check: bool = field(default_factory=lambda: os.environ.get("REQUIRE_APP_CHECK", "1") == "1")
    project_id: str = field(default_factory=lambda: os.environ.get("GOOGLE_CLOUD_PROJECT", "solmate-13571"))
    edl_secret: str = field(default_factory=lambda: os.environ.get(
        "EDL_TOKEN_SECRET", "projects/solmate-13571/secrets/edl-token/versions/latest"))
    git_sha: str = field(default_factory=lambda: os.environ.get("GIT_SHA", "dev"))
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("SOLMATE_DATA", str(REPO / "data"))))
    local_tiles: Path | None = field(
        default_factory=lambda: Path(p) if (p := os.environ.get("SOLMATE_TILES")) else None)
    rate_per_minute: int = field(default_factory=lambda: int(os.environ.get("RATE_PER_MINUTE", "20")))
    read_budget_s: float = field(default_factory=lambda: float(os.environ.get("READ_BUDGET_S", "20")))
