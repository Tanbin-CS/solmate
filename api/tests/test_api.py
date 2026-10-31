def body(**kw):
    return {"target_id": "jezero_crater", "lat": 36.5, "lon": 84.5, "size_km": 10.0} | kw


def test_health_and_version(api):
    assert api.get("/api/v1/health").json() == {"status": "ok"}
    v = api.get("/api/v1/version").json()
    assert v["offline"] is True and len(v["model_version"]) == 12


def test_terrain_scores_a_box_then_serves_it_from_cache(api):
    r = api.post("/api/v1/terrain", json=body())
    assert r.status_code == 200
    d = r.json()
    assert d["partial"] is False and d["cached"] is False
    assert 0.0 <= d["terrain_score"] <= 1.0
    assert set(d["similarity"]) == {"slope_median", "slope_p90", "hypsometric_integral"}
    assert "local_relief" in d["indicators"]  # shown, not scored
    again = api.post("/api/v1/terrain", json=body()).json()
    assert again["cached"] is True and again["terrain_score"] == d["terrain_score"]


def test_target_without_100m_model_returns_indicators_only(api):
    d = api.post("/api/v1/terrain", json=body(target_id="arcadia_planitia")).json()
    assert d["terrain_score"] is None and d["indicators"]


def test_validation_rejects_bad_input(api):
    from app import main

    main.limiter.per_minute = 100  # rejected requests count toward the limit too; not what this test checks
    assert api.post("/api/v1/terrain", json=body(lat="NaN")).status_code == 422
    assert api.post("/api/v1/terrain", json=body(size_km=5000.0)).status_code == 422
    assert api.post("/api/v1/terrain", json=body(lat=89.0)).status_code == 422
    assert api.post("/api/v1/terrain", json=body(evil="x")).status_code == 422
    assert api.post("/api/v1/terrain", json=body(target_id="../etc")).status_code == 422
    assert api.post("/api/v1/terrain", json=body(target_id="pluto")).status_code == 404


def test_ocean_box_is_partial(api):
    d = api.post("/api/v1/terrain", json=body(lat=0.0, lon=-30.0)).json()
    assert d["partial"] is True and d["terrain_score"] is None


def test_rate_limit(api):
    codes = [api.post("/api/v1/terrain", json=body()).status_code for _ in range(7)]
    assert codes[:5] == [200] * 5 and codes[-1] == 429


def test_app_check_required_when_online(api, monkeypatch):
    from app import main

    monkeypatch.setenv("OFFLINE", "0")
    main.get_settings.cache_clear()
    r = api.post("/api/v1/terrain", json=body())
    assert r.status_code == 401 and r.json() == {"detail": "missing app attestation"}
    r = api.post("/api/v1/terrain", json=body(), headers={"X-Firebase-AppCheck": "forged"})
    assert r.status_code == 401 and r.json() == {"detail": "invalid app attestation"}
