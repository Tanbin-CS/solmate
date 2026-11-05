"""One command from a changed config/event_layers.yaml to files ready to commit and deploy.

  uv run python -m solmate.pipeline.release            context layers: shown, not scored (fast)
  uv run python -m solmate.pipeline.release --scored   a layer joins the score: re-screen and
                                                       re-validate, then apply the pre-registered
                                                       rule (docs/VALIDATION.md, addendum 2)
  add --push to publish the web tiles to GCS (needs `gcloud auth login`)

Every step runs in order and the run stops at the first failure. Nothing is downloaded
here: put the dataset's files under analysis/cache/raw first (docs/EVENT_DAY.md).
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ANALYSIS = Path(__file__).resolve().parents[3]
REPO = ANALYSIS.parent
VALIDATION = REPO / "data" / "validation" / "validation.v2.json"
CHECK = REPO / "data" / "validation" / "event_check.v1.json"
MAX_AUC_DROP = 0.02  # pre-registered in docs/VALIDATION.md, addendum 2

FAST = ["event_targets", "build_stack --only event", "export_web --tiles", "report", "golden"]
SCORED = ["event_targets", "build_stack --only event", "earth_stats", "screen_v2", "rescore", "validate_v2",
          "validate_regions", "export_web --tiles", "report", "golden"]


def check_rule(before: dict, after: dict, bodies: set[str]) -> dict:
    """Median AUC (equal weights) per body, before and after; the layer passes if no body drops more than allowed."""
    rows = {}
    for body in sorted(bodies):
        b = before["summary"][body]["auc_median"]
        a = after["summary"][body]["auc_median"]
        rows[body] = {"auc_median_before": b, "auc_median_after": a, "change": round(a - b, 4),
                      "passes": a >= b - MAX_AUC_DROP}
    return {"rule": f"median AUC may fall by at most {MAX_AUC_DROP} for each body the layer is scored on",
            "bodies": rows, "passes": all(r["passes"] for r in rows.values())}


def _run(label: str, cmd: list[str], cwd: Path) -> float:
    print(f"\n== {label}", flush=True)
    t0 = time.perf_counter()
    if subprocess.run(cmd, cwd=cwd).returncode != 0:
        raise SystemExit(f"release stopped: {label} failed")
    dt = time.perf_counter() - t0
    print(f"   done in {dt:.0f} s", flush=True)
    return dt


def scored_bodies() -> set[str]:
    from importlib import resources

    import yaml

    from solmate import event

    with resources.files("solmate.config").joinpath("dimensions.yaml").open(encoding="utf-8") as f:
        dims = yaml.safe_load(f)["dimensions"]
    ids = {e["id"] for e in event.load() if e["role"] == "scored"}
    return {b for d in dims.values() if ids & set(d["indicators"]) for b in d["applies_to"]}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scored", action="store_true", help="a layer joins the score: re-screen and re-validate")
    ap.add_argument("--push", action="store_true", help="publish the web tiles to their GCS mirror")
    args = ap.parse_args()
    from solmate import event

    layers = event.load()  # a config mistake stops here, before anything runs
    print(f"event layers: {', '.join(e['id'] + ' (' + e['role'] + ')' for e in layers) or 'none'}")
    if any(e["role"] == "scored" for e in layers) and not args.scored:
        raise SystemExit("a layer has role: scored; run with --scored")
    before = json.loads(VALIDATION.read_text(encoding="utf-8")) if args.scored else None
    times = {}
    for step in SCORED if args.scored else FAST:
        mod, *rest = step.split()
        times[step] = _run(step, [sys.executable, "-m", f"solmate.pipeline.{mod}", *rest], ANALYSIS)
    if before is not None:
        result = check_rule(before, json.loads(VALIDATION.read_text(encoding="utf-8")), scored_bodies())
        CHECK.write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8", newline="\n")
        print(json.dumps(result, indent=1))
        if not result["passes"]:
            raise SystemExit("the pre-registered rule says no: set role: context for the new layer, remove it from "
                             "dimensions.yaml, restore the committed data files (git restore data frontend/public) "
                             "and run the release again without --scored")
    times["science tests"] = _run("science tests", [sys.executable, "-m", "pytest", "-q"], ANALYSIS)
    npm = shutil.which("npm")
    if npm is None:
        raise SystemExit("npm not found: run the web tests with `npm test` in frontend/")
    node = shutil.which("node")
    if node is None:
        raise SystemExit("node not found: run `node scripts/tile-fixture.mjs` in frontend/")
    # the real-tile tests in CI read a few committed tiles, which must come from this export
    times["tile fixture"] = _run("tile fixture", [node, "scripts/tile-fixture.mjs"], REPO / "frontend")
    times["web tests"] = _run("web tests", [npm, "test"], REPO / "frontend")
    if args.push:
        times["tiles push"] = _run("tiles push", ["bash", "scripts/web_tiles.sh", "push"], REPO)
    print(f"\nrelease ready in {sum(times.values()) / 60:.1f} min: commit, open a pull request, merge; CI deploys.")
    if not args.push:
        print("tiles not published yet: run scripts/web_tiles.sh push before merging.")


if __name__ == "__main__":
    main()
