# Test plan — PR #17 rationale coherence audit

App: `npm run dev` → http://localhost:5173 on `devin/1787599846-rationale-coherence` (e238720).
No auth/backend. Hard-reload the page first so stale Vite HMR entries can't pollute the console.

## Code grounding
- `src/engine/coherence.ts:44-64` — probe rules: `firmness` CONSISTENT iff response ≥ MATCH,
  else MISMATCH with note "Claimed firmness prevents salami-slicing, then gave ground.";
  `restraint` ≤ PROTEST; `proportionate` MISMATCH only on CONCEDE/ESCALATE.
- `src/engine/coherence.ts:72-117` — purchases: TRACK_LEVEL matched against
  `denial→denial`, `cost→punishment`, `hedge→intelligence` (readiness ⇒ UNSCORED);
  `deter` + CHEAP signal ⇒ MISMATCH "Deterrence by cheap talk: the Rival discounts it.";
  `reputation` without `commitmentSpec` ⇒ MISMATCH; `spiral`/`channel` ⇒ MISMATCH if an
  offensiveCoded signal went out the same turn.
- `content/baseline/signals.json` — `sig_statement` "Public Statement of Concern" is CHEAP
  (0 budget / 1 PC); `sig_redline`/`sig_tripwire_treaty` carry commitments; `sig_mobilize` is
  offensiveCoded.
- `content/baseline/rationales.json` — UI labels: firmness = "Firmness now prevents
  salami-slicing later."; deter = "Demonstrate resolve to deter probing."; denial = "Deny the
  Rival a fait accompli."; hedge = "Hedge against worsening intelligence.".
- `src/components/Debrief.tsx:277-315` — panel "Rationale audit", intro "What you said you were
  doing, against what you did. **N of M** justified decisions contradicted their stated reason.",
  columns Quarter / Decision / Stated reason / Verdict / Reading; quarter printed as
  `row.turn + 1`, and `meta.turnNumber` is 0-based (setup.ts:41, Hud.tsx:13), so audit quarter
  numbers must line up with the HUD quarter the decision was made in.
- `src/engine/analytics.ts:216-247` — `credibility = 100·(0.7·discipline01 + 0.3·coherence01)`,
  and the debrief prints `discipline` and `coherence` as indented sub-rows under Credibility.
- `src/engine/coherence.ts:169-172` — `score01 = (scored − mismatches)/scored`, or 0.6 when
  nothing scoreable.
- UI path per quarter (repo skill): Take command → Situation report "Continue" → Probe response
  (click rung, click a rationale button, "Continue") → Signals & investments (pick a Rationale
  from the card's dropdown, "Stage", then "Review & resolve") → "Resolve quarter" → "Next quarter".

## T1 — Incoherent run: every justified decision should read MISMATCH
Scenario 3 "The Mirror's Edge". Q1: stage **CONCEDE** and click the rationale button
"Firmness now prevents salami-slicing later."; on Signals & investments set the "Public
Statement of Concern" card's Rationale dropdown to "Demonstrate resolve to deter probing." and
Stage it; resolve. Repeat CONCEDE + firmness (no more purchases) each quarter until the ending
(CAPITULATION ≈ Q12), using the CDP click-driver on the visible page for the repetition.
- PASS: debrief shows a "Rationale audit" panel with a row per justified decision.
- PASS: the Q1 signal row reads Quarter **1**, Decision "Public Statement of Concern", Stated
  reason "Demonstrate resolve to deter probing.", Verdict **MISMATCH**, Reading "Deterrence by
  cheap talk: the Rival discounts it.".
- PASS: each probe row reads Quarter N, Decision "<probe title> — CONCEDE", Stated reason
  "Firmness now prevents salami-slicing later.", Verdict **MISMATCH**, Reading "Claimed firmness
  prevents salami-slicing, then gave ground.". Quarter numbers run 1..12 with no gaps and match
  the salami audit's quarters for the same probes (a `+1`/`-1` skew here is a fail).
- PASS: the summary line's two numbers equal the actual table counts: "**13** of **13**
  justified decisions contradicted their stated reason" (12 probes + 1 signal) — I will count the
  MISMATCH rows in the rendered table and compare.
- PASS: Credibility sub-rows show "Rationale coherence **0.0**" and
  `credibility ≈ 0.7·discipline + 0.3·0` (arithmetic checked against the printed numbers,
  ±0.15). If coherence is 0 but credibility equals discipline, the scoring wiring is broken.
- PASS: verdict tags are visibly colored (MISMATCH in the red accent per `.tag-mismatch`,
  index.css:341-348) and the long "Reading" text wraps inside its cell without pushing the
  table or neighbouring panels out of the viewport.

## T2 — Coherent run: CONSISTENT rows, and the PR #16 leftovers
Scenario 1 "The Approaches", "New game" from the debrief. Q1: stage **MATCH** + rationale
"Firmness now prevents salami-slicing later."; on Signals & investments Stage "Denial: Coastal
Sensor Grid" with Rationale "Deny the Rival a fait accompli." and "Intelligence: ISR Expansion"
with Rationale "Hedge against worsening intelligence."; resolve. Then MATCH + firmness every
quarter to Q32 (DETERRENCE_HOLD) via the driver, staging "Intelligence: Fusion Cell" with the
hedge rationale once it unlocks (intel ≥ 3).
- PASS: debrief Rationale audit shows **0** MISMATCH rows; probe rows read Verdict
  **CONSISTENT** / "Firmness claimed, firmness delivered."; the Sensor Grid row reads
  CONSISTENT / "Bought denial capability, as stated."; the ISR row reads CONSISTENT /
  "Bought intelligence capability, as stated.".
- PASS: summary reads "0 of M justified decisions contradicted their stated reason" with M equal
  to the number of non-UNSCORED rows.
- PASS: "Rationale coherence" sub-row reads **100.0** and
  `credibility ≈ 0.7·discipline + 0.3·100` — i.e. the same run's credibility must be visibly
  higher than T1's, proving the term actually moves the score.
- PASS (PR #16 leftover): on the Q3 SITREP the Posture Intelligence row reads **3**, the intel
  tags read **MODERATE confidence**, the why-line reads "…intelligence is at 3/10 — …about
  **±17** points…", and the unclamped band width shrinks from 40 to ~35 points vs the Q1/Q2
  screenshots.
- PASS (explicit answer for the user): after Fusion Cell lands, Intelligence reads **6**, the
  why-line reads "…at 6/10 — …about **±12** points…" and the tag is still **MODERATE** — with no
  content card above level 6, HIGH (σ < 0.10 ⇒ level ≥ 8) is unreachable in play. Report this
  as an empirical observation plus the σ arithmetic.
- PASS (Regression): the ending fires (DETERRENCE_HOLD at Q32) and the debrief renders composite
  `N / 100`, salami/signal audits and all three charts.

## T3 — Narrow-window layout
With the T1 debrief on screen, resize the browser window to ~820px wide and screenshot the
Rationale audit panel.
- PASS: the table stays inside its panel (no horizontal page scrollbar caused by it, no text
  overlapping neighbouring panels), verdict tags stay on one line, and the panels below
  (Signal audit, charts) keep their normal order and spacing.

## T4 — Console hygiene
- PASS: after the hard reload, the console contains zero errors and zero warnings across T1–T3
  (only `[vite] connected` / React DevTools info lines are acceptable).
