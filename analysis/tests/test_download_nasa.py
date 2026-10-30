"""Offline tests for the NASA downloader: granule selection and token scoping."""

import io
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import download_nasa as dn  # noqa: E402


def _fake_cmr(entries):
    payload = json.dumps({"feed": {"entry": entries}}).encode()
    return lambda *a, **k: io.BytesIO(payload)


def _entry(start, name):
    return {"time_start": start, "links": [{"rel": "http://esipfed.org/ns/fedsearch/1.1/data#",
                                            "href": f"https://data.lpdaac.earthdatacloud.nasa.gov/x/{name}"}]}


def test_temporal_window_drops_overlapping_granules(monkeypatch):
    monkeypatch.setattr(dn.urllib.request, "urlopen", _fake_cmr([
        _entry("2022-12-17T00:00:00Z", "old.hdf"),
        _entry("2023-01-01T00:00:00Z", "in.hdf"),
    ]))
    p = dn.Product("MYD11C3", "061", "t", ("2023-01-01", "2024-12-31"))
    assert [g.url.rsplit("/", 1)[1] for g in dn.search(p)] == ["in.hdf"]


def test_one_per_month_keeps_granule_nearest_mid_month(monkeypatch):
    monkeypatch.setattr(dn.urllib.request, "urlopen", _fake_cmr([
        _entry("2023-01-01T00:00:00Z", "jan01.hdf"),
        _entry("2023-01-14T00:00:00Z", "jan14.hdf"),
        _entry("2023-01-28T00:00:00Z", "jan28.hdf"),
        _entry("2023-02-16T00:00:00Z", "feb16.hdf"),
    ]))
    p = dn.Product("MCD43C3", "061", "t", ("2023-01-01", "2023-12-31"), one_per_month=True)
    assert [g.url.rsplit("/", 1)[1] for g in dn.search(p)] == ["jan14.hdf", "feb16.hdf"]


def _redirect(to_url):
    handler = dn._StripAuthOffHost()
    req = urllib.request.Request("https://data.lpdaac.earthdatacloud.nasa.gov/a.hdf",
                                 headers={"Authorization": "Bearer secret"})
    return handler.redirect_request(req, None, 302, "Found", {}, to_url)


def test_token_not_forwarded_to_non_earthdata_host():
    new = _redirect("https://lp-prod-protected.s3.us-west-2.amazonaws.com/a.hdf?X-Amz-Signature=1")
    assert not new.has_header("Authorization")


def test_token_kept_for_earthdata_login_host():
    new = _redirect("https://urs.earthdata.nasa.gov/oauth/authorize?client_id=x")
    assert new.get_header("Authorization") == "Bearer secret"
