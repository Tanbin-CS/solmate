# UX flows and wireframes (v2)

The design keeps the prototype's visual language: dark space theme, existing
tokens in `frontend/src/design`, and shadcn/Radix components. New UI reuses
those components. There is no new design system.

## Flow A: "Take the tour" (judge, at most 60 s, no typing)
```
Home hero ──[Take the tour]──▶ Explorer(target = Mons Mouton Plateau)
  1 globe repaints with SAI surface ──▶ 2 camera flies to top NOVEL lead
  3 Site panel opens: SAI 0–100 · DimensionBars · VerdictCard (Matches / Differs / Breaks down)
  4 Side-by-side imagery (Earth HLS | LOLA hillshade, 20 km, scale bars)
  5 Switch target to Jezero ──▶ globe repaints ──▶ tour ends on "Draw your own box" hint
```
Each step can be skipped (Esc). With reduced motion, the camera jumps instead of flying.

## Flow B: Score any place
```
Explorer ─[Draw box] or [Score map centre] or [lat/lon form]─▶
  coarse SAI (worker, ≤100 ms) shown with "refining terrain…" ──▶ refined (≤8 s)
  ├─ API failed ─▶ keep coarse, notice "terrain refinement unavailable"
  └─ actions: Dossier PDF · Nominate this place · Compare · Export
```

## Flow C: Nominate
```
Nominate dialog (prefilled with box + auto SAI) ─▶ fields: type, title, description,
evidence URLs (≤3, https), optional name/affiliation, consent ─▶ submit (App Check)
─▶ "Thanks — pending review" (not public until approved)
```

## Flow D: Review (reviewer only)
```
/review (Google sign-in, reviewer claim) ─▶ pending list ─▶ detail (map, auto SAI,
evidence) ─▶ Approve / Reject / Spam + note ─▶ approved shows as community pin
```

## Wireframe: Explorer site panel (desktop right rail / mobile bottom sheet)
```
┌──────────────────────────────────────────────┐
│ Hoggar plateau cell 23.1°N 5.6°E  NOVEL 640km│
│ SAI 78 / 100   coverage 0.92   [Dossier]     │
├──────────────────────────────────────────────┤
│ Terrain     ████████▉  0.89                  │
│ Thermal     ███████▌   0.75                  │
│ Surface     ███████    0.70                  │
│ Mineralogy  ████▌      0.45  differs         │
│ Ice/illum.  █          0.10  Earth can only  │
│                              approach         │
├──────────────────────────────────────────────┤
│ Matches: steep relief, barren, large day-    │
│ night swing. Differs: mafic signal weak.     │
│ Breaks down: 1 g vs 0.165 g · air vs vacuum  │
│ · radiation (CRaTER).   Use it for: rover    │
│ mobility tests, thermal cycling.             │
├──────────────────────────────────────────────┤
│ [Earth HLS 20 km] [Moon LOLA hillshade 20 km]│
└──────────────────────────────────────────────┘
```

## Wireframe: Explorer layout
```
┌ Target ▾ (Artemis regions | Mars) ─ Presets: Equal Expert Learned Ops ─ Weights ▸ ┐
│ ┌ Tabs: Ranked · Dimension leaders · Novel leads · Community ┐ ┌──── Globe ────┐ │
│ │ list …                                                     │ │ SAI surface   │ │
│ └────────────────────────────────────────────────────────────┘ │ [Draw box]    │ │
└──────────────────────────────────────────────────────────────── └───────────────┘ ┘
```

## Accessibility notes
- Every map action has a button or form alternative.
- Bars carry text values.
- Colour is never the only signal.
- Focus moves in order: target → presets → tabs → list → map.
- The live score region uses `aria-live="polite"`.
