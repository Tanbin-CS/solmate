# MoSCoW prioritisation (v2)

These labels mirror the GitHub issue labels `must`, `should`, `could` and `wont`.
Story IDs refer to the [PRD](PRD.md).

## Must (release blockers)
- Repo governance and docs (phases 1–5); security CI suite; commit discipline.
- Dimensions T, C, Th, S, M, plus I for the Moon; NASA data only in scores.
- 9 Artemis III regions + Jezero as targets; SAI branding (US-02, US-03).
- Dimension leaders, novel leads, breaks-down (US-04, US-06, US-07).
- Two-stage global screening; validation v2 with CIs and learned weights (US-13).
- Live scoring of any place, with fallback and offline mode (US-05, US-16).
- Presets and weights (US-08); side-by-side imagery (US-09); the tour (US-01).
- Findings report with 2 flagship case studies; "Use it for" lines (US-14).
- Firebase Hosting + Cloud Run deploy; monitoring; rollback.
- Content: AI_USE, DATA_SOURCES, the 240 s and 30 s videos, the NASA project page.

## Should
- Dossier PDF (US-10); nominations and review (US-11, US-12).
- Arcadia Planitia target with the SWIM ice dimension; dust dimension (MERRA-2).
- Process tags (US-15); habitability context panel.
- Playwright + axe; Lighthouse CI; rc-channel smoke gate; uptime alerts.
- NASADEM cross-check; HLS quicklooks.

## Could
- Subsurface, lava-tube and mine pins (cited, not scored).
- Field-photo upload with nominations.
- Radar chart; Bangla UI; JAXA Kaguya extra; Jev check on nominations.
- A third target (Arsia Mons skylights).

## Won't (this release)
- Mars Climate Database (licence); deep learning of any kind.
- Public user accounts; live NASA calls during the demo; cave scoring.

## Cut order if late (first cut first)
Could → rc gate → review UI (use the Firebase console instead) → print-CSS
dossier → static surface PNG → nominations → Arcadia → reduce Artemis regions to
4 (Mons Mouton Plateau, Malapert, Haworth, de Gerlache Rim 2).

**Never cut:** live scoring, breaks-down, validation with learned weights,
offline mode, AI_USE, security gates, commit discipline.
