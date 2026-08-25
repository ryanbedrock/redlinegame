# Test plan — PRs #26/#27/#28 (branch devin/1784406219-phase0-engine, 49cee2e)

App: `npm run dev` → http://localhost:5173 (running, 200). No auth/backend. Hard-reload once at
the start; state is in-memory Zustand (skill gotcha), tree frozen.

## Code grounding
- `src/components/ScenarioSelect.tsx:37-57` — per scenario `<li>`: name, `{turnCount} quarters ·
  {turnCount/4} years`, description, `p.muted` flavor, and `p.scenario-facts`
  "Opening: N budget (+I per quarter) · P Political Capital · denial/punishment/intelligence/
  readiness · Rival prior arming X · serial SEED".
- `src/components/Briefing.tsx:69-75` — §1 Situation panel opens with
  `<figure className="theatre-map"><img src={amber-approaches.webp}>`.
- `src/components/ProbeResponse.tsx:48-57` — chart inset from `PROBE_CHARTS[probe.id]`; caption
  `"{figure} — {probe.title}, quarter {min(turnNumber+1, turnCount)}. Positions as reported;
  sourcing unconfirmed."`
- `src/components/probeCharts.ts` — fishing→Fig. 1A/probe-fishing.webp, incursion→Fig. 1B/
  probe-incursion.webp, blockade→Fig. 1C/probe-blockade.webp, seizure→Fig. 1D/probe-seizure.webp.
- Route (verified by simulating the pure `resolveTurn` on scenario 1, seed 1337,
  PRESSURED_EXPANSIONIST, no purchases / no diagnosis / no inbox replies; identical with the
  auto-selected first rationale): rungs
  `MATCH, PROTEST, ENFORCE, PROTEST, ENFORCE, ESCALATE, ENFORCE, ESCALATE, MATCH, ESCALATE,
  ESCALATE, MATCH, MATCH, CONCEDE, ESCALATE, ENFORCE`
  ⇒ probes Q1 fishing, Q3 incursion, Q11 blockade, Q16 **seizure**, WAR at Q16.
  All four charts are therefore reachable in one 16-quarter run.

## T1 — Scenario select (PR #26)
On the hard-reloaded landing page, screenshot the three `li` entries. Pass iff:
- "The Approaches" · `32 quarters · 8 years` · facts line contains `Opening: 20 budget` and
  `serial 1337`.
- "The Closing Window" · `40 quarters · 10 years` · `Opening: 18 budget` … `serial 2718`.
- "The Mirror's Edge" · `40 quarters · 10 years` · `Opening: 20 budget` … `serial 3141`.
- Each entry shows a non-empty description paragraph and a distinct muted flavor line.
Fail if any facts line is missing, budgets/serials differ, or the years figure ≠ quarters/4.

## T2 — Briefing theatre chart, all three scenarios (PR #27)
For each scenario: click "Take command", screenshot the §1 Situation panel. Pass iff a rendered
map image sits at the top of §1 Situation inside `figure.theatre-map`, its `src` filename contains
`amber-approaches`, and `naturalWidth > 0`. Return to the landing page (reload) between scenarios
1→2→3; do the chart-run last on scenario 1 so nothing is reloaded mid-run.

## T3 — Four probe charts (PR #28) — primary flow
Fresh scenario 1 game, play the 16-quarter route above through the visible UI (rung → Continue →
Review & resolve → Resolve quarter → Next quarter; no purchases, no diagnosis, no inbox replies).
At each of the four chart quarters, screenshot the probe screen and record, from the visible page,
the `img` src, `naturalWidth`, figcaption text and the HUD quarter label. Pass iff:
- Q1 "Grey-Hull Fishing Fleet": src filename contains `probe-fishing`, caption starts
  `Fig. 1A — Grey-Hull Fishing Fleet, quarter 1.` and ends `Positions as reported; sourcing
  unconfirmed.`
- Q3 "Frontier Air Incursion": `probe-incursion`, `Fig. 1B — Frontier Air Incursion, quarter 3.`
- Q11 "Customs Quarantine": `probe-blockade`, `Fig. 1C — Customs Quarantine, quarter 11.`
- Q16 "Disputed Feature Seizure": `probe-seizure`, `Fig. 1D — Disputed Feature Seizure, quarter 16.`
- Every image has `naturalWidth > 0`.
- The caption quarter equals the HUD "Quarter N of 32" number on all four (≥2 required).
Fail if any figure letter, filename or title is mismatched (e.g. Fig. 1A on a non-fishing probe,
or the fishing image reused), or the caption quarter lags/leads the HUD quarter.

## T4 — Regression: quarter loop with charts present
During T3, confirm each of the 16 quarters advances: SITREP → probe (chart) → Signals →
Confirm → "Quarter N resolved" → next quarter, ending with the WAR banner at Q16. Pass iff no
blank screen, no stuck disabled Continue after a rung is staged, and the HUD quarter increments
by one each cycle.

## T5 — Network / console hygiene
Before the run, clear the console; enable CDP Network + Log domains. At the end read:
- zero `console.error`/warning entries and zero uncaught exceptions (only `[vite] connected` /
  React DevTools info allowed; any `[vite] hot updated` means the tree moved ⇒ run void).
- zero HTTP responses with status ≥ 400 (in particular no 404 for any `*.webp`).
- every `img` on the visited screens has `naturalWidth > 0` (checked per screen in T2/T3).
