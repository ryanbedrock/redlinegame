---
name: testing-red-line-ui
description: How to run and end-to-end test The Red Line (Vite + React + Zustand deterrence game) in a browser, including how to reach each ending and how to script long multi-quarter playthroughs over Chrome DevTools Protocol.
---

# Testing The Red Line game UI

## Running the app
- `npm install` (blueprint maintenance already does this), then `npm run dev` → http://localhost:5173.
- No backend, no auth, no secrets. Chrome is already running with CDP on http://localhost:29229.
- Useful checks: `npm run lint`, `npm run typecheck`, `npm run validate-content`, `npm test`.

## Screen flow (per quarter)
ScenarioSelect ("Take command") → Situation report ("Continue") → Probe response (click a
rung in the ladder, then "Continue" — it stays disabled until a rung is staged) →
Signals & investments ("Review & resolve") → Confirm the quarter ("Resolve quarter") →
"Quarter N resolved" ("Next quarter" / "To the war epilogue" / "To the debrief").
Some quarters have no probe; the heading then reads "No provocation this quarter".

## Reaching the endings (default seeds only — the UI has no `?seed=` support)
The store starts games with `content.scenario.defaultSeed`, so ending reachability is fixed
per scenario. As of the playable-loop work:
- **WAR** — scenario 2 "The Closing Window": CONCEDE every probe, buy nothing → WAR at Q2,
  then a four-decision epilogue.
- **CAPITULATION** — scenario 3 "The Mirror's Edge": CONCEDE every probe (buying denial
  investments is fine) → status-quo integrity reaches 0 around Q12.
- **DETERRENCE_HOLD** — scenario 1 "The Approaches": MATCH every probe → survives all 32
  quarters. If a strategy stops producing an ending after balance changes, simulate the
  engine directly (`resolveTurn` from `src/engine/resolver.ts` is pure) in a scratch script
  to find a working strategy before clicking through the UI.

## Scripting long playthroughs (32–40 quarters) over CDP
Clicking 32 quarters by hand is impractical. Drive the *visible* page (so it still records)
with a page-side loop injected via `Runtime.evaluate`:
- `npm install ws --no-save` in /tmp (Node 20 has no global WebSocket), fetch the page target
  from `http://localhost:29229/json/list`, then evaluate an async IIFE with `awaitPromise: true`.
- The loop should branch on `document.querySelector('h2.phase-heading')` text, click
  `.actions button` by its label, pick a probe rung by matching `.option-type` text, and stop
  when `h1` reads "Debrief". Log the resolution heading plus `.ending-banner` text so you can
  assert which quarter produced the ending.
- Keep ~120 ms sleeps between clicks so React re-renders and the recording is watchable.

## Gotchas
- Game state lives only in an in-memory Zustand store — there is no persistence. Any source
  edit triggers a Vite HMR update, and several modules (e.g. `Hud.tsx`, which also exports
  `TRACK_LABELS`, so Fast Refresh is invalidated) force a full page reload that throws the
  campaign back to the scenario-select screen. Freeze the working tree before starting a
  multi-quarter playthrough, and hard-reload once at the beginning rather than mid-run; if the
  app unexpectedly returns to the landing page, check `git status` / file mtimes before
  reporting it as an app bug.
- Clicking the diagnosis checkpoint adds a "Withdraw assessment" button, shifting the
  "Review & resolve" button down — re-screenshot before clicking by coordinate.
- The HUD/DOM often reports content as `offscreen`; scroll and use screenshots as evidence.
- Investment cards show a disabled reason ("Prerequisites not met" / "Insufficient
  resources" / "Purchase limit reached" / "Cooling down (N quarters)"). Prereq and
  affordability are easy to hit (overspend the 20 budget in Q1). The other two need a
  purchase in an *earlier* quarter — they never appear if you only look at Q1:
  - Buy an investment in Q1 (every card in `content/baseline/investments.json` is
    `maxPurchases: 1`, e.g. `inv_denial_1` "Denial: Coastal Sensor Grid", 6 budget) → from Q2
    onward its Stage button is disabled with "Purchase limit reached" (permanent).
  - Buy a signal with `cooldownTurns: 2` (e.g. `sig_exercise` "Sunk-Cost Joint Exercise",
    5 budget / 1 PC) in Q1 → Q2 shows "Cooling down (2 quarters)" and Q3 is stageable again
    (gate is `turnNumber - lastPurchaseTurn < cooldownTurns`).
  - Keep enough budget in the later quarter that affordability doesn't mask the reason you
    are trying to observe — the precedence is prereq → limit → cooldown → affordability.
- Selecting a probe response rung auto-selects the *first* rationale of record
  (`ProbeResponse.tsx`: `set?.options[0]?.id ?? 'unspecified'`), so every answered probe is a
  scoreable justified decision. A run with `Rationale coherence = n/a` is therefore not
  reachable through normal UI play — do not plan a test around it without an engine-level
  fixture (or a scenario where no probe ever fires).
- Testing the commitment ledger (`sig_redline` floor MATCH / scope `frontier`;
  `sig_tripwire_treaty` floor ENFORCE / scope `frontier`+`maritime`):
  - Probe scopes: `probe_fishing` maritime only, `probe_incursion`/`probe_seizure` frontier,
    `probe_blockade` maritime+frontier. A Q1 red line is *not* tested by the usual Q1 fishing
    probe → clean "STANDING / no in-scope provocation has tested it yet" shot.
  - Same-quarter regression: commitments are created after the probe resolves, so a probe
    answered in the declaration quarter must produce NO ledger row and leave status STANDING.
  - Broken case (fast): scenario 3, declare the red line in Q1 and CONCEDE everything —
    Customs Quarantine in Q3 breaks it, WAR lands ~Q4, so the whole case takes ~4 quarters.
  - The CDP driver overshoots the SITREP; use the on-screen "Back" buttons (Signals → Probe
    response → Situation report) to get back to the commitment register for a screenshot.
- Debrief "Composite score" renders as `N / 100` and must equal the weighted mean of the five
  sub-scores shown beneath it (weights in `content/baseline/scenario.json` → scoring.weights:
  outcome .35, robustness .25, diagnosis .20, credibility .10, efficiency .10). Verify by
  arithmetic on the displayed values; a value below 1.0 means the ×100 scaling regressed.
  Note the diagnosis sub-score is 0 unless you stage a type belief at the diagnosis
  checkpoint each quarter — do so if you want a non-trivial weighted-mean check.
- The debrief runs `runCounterfactualReport` synchronously; on these scenarios it rendered in
  well under a second, but watch for a hang if scenario turn counts grow.
- Deterministic route that surfaces all four probes in one campaign (scenario 1, default seed
  1337, no purchases, no diagnosis, no inbox responses): answer the rungs in order
  `MATCH, PROTEST, ENFORCE, PROTEST, ENFORCE, ESCALATE, ENFORCE, ESCALATE, MATCH, ESCALATE,
  ESCALATE, MATCH, MATCH, CONCEDE, ESCALATE, ENFORCE` → fishing Q1, incursion Q3, blockade
  Q11, seizure Q16, and WAR at Q16 (epilogue renders). Confirmed twice.
- Staging a rung is free: only the *committed* rung enters the resolver, so on any probe screen
  you can click all five rungs in turn — harvesting all five `resp-<probe>-<rung>.webp` response
  charts — without changing which probe appears next quarter.
