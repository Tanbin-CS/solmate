"""The container build copies only files that .dockerignore lets into the build context."""

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_every_copied_data_file_is_in_the_build_context():
    allowed = {line[1:] for line in (REPO / ".dockerignore").read_text(encoding="utf-8").splitlines()
               if line.startswith("!")}
    copied = [src for line in (REPO / "Dockerfile").read_text(encoding="utf-8").splitlines()
              if line.startswith("COPY ") and "--from" not in line
              for src in line.split()[1:-1] if src.startswith("data/")]
    assert copied
    for src in copied:
        assert src in allowed or f"{src.rstrip('/')}/**" in allowed, f"{src} is copied but excluded by .dockerignore"
        assert (REPO / src).exists(), f"{src} is copied but missing"
