# Test plan — PR #29 response charts (branch devin/1787670300-response-charts, ddf7d0c)

App: `npm run dev` → http://localhost:5173 (running, 200). No auth/backend. Hard-reload once at
the start; state is in-memory Zustand, tree frozen at ddf7d0c (clean).

## Code grounding
- `src/components/ProbeResponse.tsx:24-25` — `responseChart = RESPONSE_CHARTS[probe.id]?.[selected.responseType]`
  where `selected` is the staged rung (`draft.probeResponse.responseType`).
- `src/components/ProbeResponse.tsx:89-102` — second `section.panel`, `h3` "Your response, as it
  would look", `span.tag` = `selected.responseType`, `figure.theatre-map > img src=responseChart.src`,
  caption `"{selected.label} — {responseChart.summary} Projected; not yet ordered."`
- `src/components/probeCharts.ts:58+` — all 20 keys present: {probe_fishing, probe_incursion,
  probe_blockade, probe_seizure} × {CONCEDE, PROTEST, MATCH, ENFORCE, ESCALATE} → `resp-<probe>-<rung>.webp`.
- Provocation chart (PR #28) unchanged at lines 50-59 (Fig. 1A–1D, caption quarter =
  `min(turnNumber+1, turnCount)`).
- Ladder labels (`content/baseline/probes.json`), used to verify the caption's option label:
  - fishing: CONCEDE "Ignore it — not worth a confrontation." / PROTEST "Lodge a formal diplomatic
    protest." / MATCH "Shadow them with your own coast guard." / ENFORCE "Escort the fleet out and
    publicize it." / ESCALATE "Interdict and detain the cutter."
  - incursion: "Note it and stand down." / "Protest and release radar tracks publicly." /
    "Scramble a proportionate intercept." / "Establish a standing combat air patrol." /
    "Announce weapons-free rules on repeat incursions."
  - blockade: "Reroute your shipping quietly." / "Condemn it and rally partners." / "Run an
    escorted convoy through." / "Break the quarantine with a naval task group." / "Impose a
    counter-blockade of your own."
  - seizure: "Protest on paper; accept the new fact." / "Take it to international bodies." /
    "Occupy an adjacent feature in response." / "Blockade and isolate the garrison." / "Retake the
    feature by force."
- Route (verified last run by simulating the pure resolver): scenario 1, no purchases, rungs per
  quarter `MATCH, PROTEST, ENFORCE, PROTEST, ENFORCE, ESCALATE, ENFORCE, ESCALATE, MATCH, ESCALATE,
  ESCALATE, MATCH, MATCH, CONCEDE, ESCALATE, ENFORCE` ⇒ probes Q1 fishing, Q3 incursion,
  Q11 blockade, Q16 seizure. Clicking extra rungs before committing does not change the schedule
  (only the committed rung enters the resolver).

## T1 — 20 response-chart mappings (primary)
On each of the four probe screens (Q1 fishing, Q3 incursion, Q11 blockade, Q16 seizure), click the
ladder buttons in order CONCEDE → PROTEST → MATCH → ENFORCE → ESCALATE. After each click, read from
the live page the response panel's `h3`, `span.tag`, `img` src + `naturalWidth`, and figcaption.
Pass for a cell iff **all** of:
- `h3` = "Your response, as it would look";
- tag text = the rung just clicked (e.g. `ESCALATE`);
- img src filename = `resp-<probe>-<rung>.webp` for exactly that probe+rung (e.g. blockade+ESCALATE
  ⇒ `resp-blockade-escalate.webp`);
- caption starts with the ladder button's own label text (table above) and ends
  `Projected; not yet ordered.`;
- `naturalWidth > 0`.
Screenshot at least one rung per probe (4 screenshots) plus the two rungs used for the swap check,
so every claim of on-screen visibility is backed by pixels. 20/20 cells must pass.
Fail if any src is for a different probe or rung (the obvious break: a stale/wrong mapping such as
fishing art on the blockade probe), if the tag and src disagree, or if the caption label belongs to
a different rung.

## T2 — Swap / no stale image + Back-and-return consistency
On the Q11 blockade screen: with ESCALATE staged, click CONCEDE. Pass iff the img src changes from
`resp-blockade-escalate.webp` to `resp-blockade-concede.webp` in the same panel (no second figure,
no leftover escalate image anywhere on the page) and the tag flips ESCALATE→CONCEDE. Then click
MATCH, press the on-screen "Back" button (→ Situation report), press "Continue" to re-enter the
probe screen. Pass iff the ladder still shows MATCH selected and the response panel still shows
`resp-blockade-match.webp` with tag MATCH (i.e. panel is derived from the staged selection, not
transient state).

## T3 — Provocation chart regression (PR #28)
On each of the four probe screens confirm the Fig. panel still renders above the ladder with
`probe-<probe>.webp` and caption `Fig. 1A/1B/1C/1D — <title>, quarter N.` where N equals the HUD
"Quarter N of 32". Required on ≥2 quarters; will be checked on all 4.

## T4 — Quarter-loop regression with the extra panel
Advance the route through the UI. Pass iff each quarter still goes SITREP → probe (2 panels) →
Signals & investments → Confirm the quarter → "Quarter N resolved", HUD quarter incrementing by 1,
Continue enabled after a rung is staged, and Q16 resolves to a terminal screen (previous run: WAR).
Fail on any blank screen, stuck disabled Continue, or skipped phase.

## T5 — Network / console hygiene
At the end of the run read the console and `performance.getEntriesByType('resource')`. Pass iff:
- zero console errors/warnings and zero uncaught exceptions (`[vite] connected` / React DevTools
  info allowed; any `[vite] hot updated` during the run ⇒ tree moved, run void);
- zero responses with status ≥ 400 among `resp-*.webp` / `probe-*.webp` / `amber-*.webp` (the known
  pre-existing `favicon.ico` 404 is the only permitted ≥400);
- every visited `img` had `naturalWidth > 0` (recorded per cell in T1/T3).
- All 20 `resp-*.webp` appear in the resource list with status 200 by the end (proves each mapping
  actually fetched its own distinct asset).
