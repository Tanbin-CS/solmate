"""Request and response models. Strict validation is the first security control."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TerrainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    target_id: str = Field(min_length=1, max_length=40, pattern=r"^[a-z0-9_]+$")
    lat: float = Field(ge=-83.0, le=83.0, allow_inf_nan=False)
    lon: float = Field(ge=-180.0, le=180.0, allow_inf_nan=False)
    size_km: float = Field(default=20.0, ge=10.0, le=40.0, allow_inf_nan=False)

    @field_validator("lat", "lon")
    @classmethod
    def snap(cls, v: float) -> float:  # snap to 0.01 degree so near-identical boxes share a cache entry
        return round(v, 2)


class TerrainResponse(BaseModel):
    model_version: str
    target_id: str
    lat: float
    lon: float
    size_km: float
    indicators: dict[str, float | None]
    similarity: dict[str, float]
    terrain_score: float | None
    cached: bool
    partial: bool
    source: str
    timings_ms: dict[str, int]
