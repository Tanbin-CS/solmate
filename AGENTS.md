# Agent instructions (tool-agnostic)

The rules in [CLAUDE.md](CLAUDE.md) apply to every coding agent and human
contributor: NASA data first, deterministic `compute/` with no network or LLM,
offline-capable demo path, no secrets anywhere, validated inputs, Conventional
Commits with one logical change each, OSI licences only.

Before opening a PR run the web, science and secret-scan commands listed in
CLAUDE.md and make sure they pass.
