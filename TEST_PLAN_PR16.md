# Test plan — PR #16 intel uncertainty gauge

App: `npm run dev` → http://localhost:5173 on `devin/1787599156-intel-uncertainty` (b4f088c).
No auth/backend. Console watched throughout (fresh page reload first so stale Vite HMR
entries from server restarts don't pollute the log).

## Code grounding (expected numbers, so a broken build looks different)
- `src/engine/formulas.ts:86-94` — `intelSigma(L, s0, s10) = s0 + (s10-s0)·L/10`.
  `content/baseline/scenario.json:39-40` → `intelSigmaLevel0 = 0.22`, `intelSigmaLevel10 = 0.05`.
- `src/engine/resolver.ts:414-418` — `confidenceFor`: σ ≥ .18 → LOW, σ ≥ .10 → MODERATE, else HIGH.
- `content/baseline/scenario.json:16` — scenario 1 starts `intelligence: 1`.
- Therefore, for scenario 1 "The Approaches":
  | intel level | σ | margin shown (`round(σ·100)`) | tag |
  |---|---|---|---|
  | 1 (start) | .203 | **±20** | LOW |
  | 3 (`inv_intel_1`) | .169 | **±17** | MODERATE |
  | 6 (`inv_intel_2`) | .118 | **±12** | MODERATE |
  | 8+ | <.10 | — | HIGH |
  No content card sets intelligence above 6 (`content/baseline/investments.json`:
  `inv_intel_1` level 3, `inv_intel_2` level 6), so **HIGH is expected to be unreachable
  through play**; that will be reported as a coverage gap, not asserted as a pass.
- `src/components/IntelEstimateRow.tsx:12-14,45-49` — `coarse(v)=round(v·100/5)·5`;
  `lo=coarse(clamp01(v-σ))`, `hi=coarse(clamp01(v+σ))`, band `left:lo%`, `width:(hi-lo)%`,
  marker `left:reading%`. So at level 1 an unclamped band spans **40 points** (lo→hi),
  at level 3 **35**, at level 6 **25** (rounding to the nearest 5 may shift ±5).
- `inv_intel_1` "Intelligence: ISR Expansion" 5 budget / 0 PC, `leadTimeTurns: 2`;
  effective lead = `max(1, round(2 − readiness·0.15))` = 2 with readiness 2 (resolver.ts:226-234).
  `inv_intel_2` 8 budget / 1 PC, lead 3, requires `tracks.intelligence ≥ 3`.
- UI path per quarter (repo skill): Take command → Situation report "Continue" → Probe
  response (click a rung → "Continue") → Signals & investments ("Stage" a card, then
  "Review & resolve") → "Resolve quarter" → "Next quarter".
- Panel location: SITREP right-hand panel "Intelligence estimates" (`src/components/Sitrep.tsx:76-89`),
  which renders one `IntelEstimateRow` per estimate whose `turn` equals the current quarter.

## T1 — LOW baseline: four gauges render correctly (scenario 1)
Start "The Approaches" and advance to the first SITREP whose Intelligence estimates panel is
populated (world.intel starts empty at setup.ts:75, so this may be Q2). Screenshot the panel.
- PASS: exactly **four** rows — "Their read of our resolve", "Their read of our capability",
  "Assessed hostile intent", "Rival arming level".
- PASS: every row visibly shows a horizontal track with a **shaded band** and a **thin vertical
  marker** (both visible in the screenshot pixels, not just the DOM).
- PASS: each reading line reads `~N (lo–hi)` where N, lo, hi are all **multiples of 5**.
- PASS: `hi − lo == 40` for every row whose band is not clamped at 0 or 100 (level 1 → ±20).
  Any other width (e.g. 0, or a value unrelated to ±20) is a fail.
- PASS: the marker sits **inside** the band — verified numerically as `lo ≤ N ≤ hi` from the
  reading line AND visually in the screenshot (marker line falls within the shaded region).
- PASS: each row's tag reads "LOW confidence" and the italic why-line reads
  "LOW confidence because intelligence is at **1/10** — reporting carries about **±20** points
  of error…". A margin that does not equal the table above means σ is not being recomputed
  from the track.

## T2 — Edge clamping (same screen)
Identify a row whose reading is ≤ 20 or ≥ 80 (early game "Assessed hostile intent" tracks
warUtility ≈ 0, so a low reading is expected; if none is extreme in that quarter, advance
quarters until one is).
- PASS: for a low row, the reading line shows `lo = 0` (not a negative number) and the shaded
  band's left edge is flush with the track's left edge, with **no overflow** past it.
- PASS: measured geometry — band rect is contained in the track rect (left ≥ track.left − 1px,
  right ≤ track.right + 1px), confirmed on screen in the screenshot.
- FAIL indicators: negative lo/hi text, band extending beyond the rounded track, marker
  outside the track.

## T3 — Investing in intelligence narrows the band (primary flow)
Same scenario-1 run. In Q1's Signals & investments, Stage "Intelligence: ISR Expansion"
(5 budget). Resolve, and play forward with MATCH responses.
- PASS: SITREP "In the pipeline" lists "Intelligence: ISR Expansion — N quarter(s) remaining"
  and the Posture table's Intelligence row goes **1 → 3** two quarters later.
- PASS: on the first SITREP after it lands, the intel panel tags flip to **MODERATE
  confidence**, the why-line reads "…intelligence is at **3/10** — …about **±17** points…",
  and the band width shrinks: `hi − lo == 35` on unclamped rows (vs 40 before). Same
  before/after screenshots for the report.
- Then stage "Intelligence: Fusion Cell" (8 budget / 1 PC, unlocked at intel ≥ 3), play three
  more quarters.
  - PASS: Intelligence track reaches **6**, why-line reads "…at 6/10 — …about **±12** points…",
    unclamped band width `hi − lo == 25`, and the band is visibly narrower again.
- HIGH tier: expected unreachable (needs level ≥ 8). Will be reported as **untested** with the
  σ arithmetic, not silently skipped.

## T4 — No two-decimal precision left in the panel
On each intel panel screenshot above:
- PASS: no substring matching `\d+\.\d\d` appears anywhere in the "Intelligence estimates"
  panel (the old code printed e.g. "0.47"); the flavor prose contains "NN/100" with NN a
  multiple of 5, matching the `~N` reading on the same row.

## T5 — Regression: quarter loop + one ending + debrief
Label as Regression in the report.
- PASS: probe response → signals → resolution loop works for the quarters played in T3
  (resolution shows ledger deltas and "Next quarter" advances the HUD).
- PASS: reach one ending (scenario 3 "The Mirror's Edge", CONCEDE every probe → CAPITULATION
  ≈ Q12 is fastest, driven by the CDP click-driver on the visible page) and its Debrief renders
  ending, composite `N / 100`, audits and all three charts.
- PASS: after a fresh page load, browser console contains **zero errors and zero warnings**
  (only `[vite] connected` / React DevTools info lines are acceptable).
