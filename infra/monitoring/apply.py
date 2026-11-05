"""Create SolMate's uptime checks, e-mail channel and alert policies (skips any that exist).

Usage:  python infra/monitoring/apply.py <alert e-mail address>
Needs:  gcloud signed in as a project owner (uses `gcloud auth print-access-token`).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

P = "solmate-13571"
API = f"https://monitoring.googleapis.com/v3/projects/{P}"
HERE = Path(__file__).resolve().parent


def call(method: str, path: str, body: dict | None = None) -> dict:
    gcloud = shutil.which("gcloud") or shutil.which("gcloud.cmd")
    token = subprocess.run([gcloud, "auth", "print-access-token"], capture_output=True, text=True, check=True).stdout.strip()
    req = urllib.request.Request(f"{API}/{path}", method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": f"Bearer {token}", "x-goog-user-project": P,
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def names(path: str, key: str) -> set[str]:
    return {x["displayName"] for x in call("GET", path).get(key, [])}


def main() -> None:
    email = sys.argv[1]
    have = names("uptimeCheckConfigs", "uptimeCheckConfigs")
    for f in ("uptime-site.json", "uptime-api.json", "uptime-data.json"):
        cfg = json.loads((HERE / f).read_text(encoding="utf-8"))
        print("exists:" if cfg["displayName"] in have else "created:",
              cfg["displayName"] if cfg["displayName"] in have else call("POST", "uptimeCheckConfigs", cfg)["name"])

    channels = call("GET", "notificationChannels").get("notificationChannels", [])
    channel = next((c["name"] for c in channels if c.get("labels", {}).get("email_address") == email), None)
    if not channel:
        channel = call("POST", "notificationChannels",
                       {"type": "email", "displayName": "SolMate alerts", "labels": {"email_address": email}})["name"]
        print("created channel:", channel)

    have = names("alertPolicies", "alertPolicies")
    for f in ("alert-uptime.json", "alert-api-errors.json", "alert-api-latency.json"):
        pol = json.loads((HERE / f).read_text(encoding="utf-8"))
        if pol["displayName"] in have:
            print("exists:", pol["displayName"])
            continue
        print("created:", call("POST", "alertPolicies", {**pol, "notificationChannels": [channel]})["name"])


if __name__ == "__main__":
    main()
