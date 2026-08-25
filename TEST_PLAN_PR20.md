# Test plan — PR #20 exact commitment PC (branch devin/1787600597-exact-commitment-pc, 5693488)

App: `npm run dev` → http://localhost:5173 (running, HTTP 200). No auth/backend.
Hard-reload once at the start; game state is in-memory Zustand, so never reload mid-run.

## Code grounding
- `src/engine/resolver.ts:100-139` — commitment lifecycle runs inside probe resolution: honored ⇒
  `politicalCapital + tuning.honoredTestPC` (=2, scenario.json:33) and status HONORED; broken ⇒
  `politicalCapital - backDownPenaltyPC * audienceMult`, clamped to [0, pcCap], status BROKEN and
  `if (c.status === 'BROKEN') continue` on later probes. The pushed record's
  `pcDelta = politicalCapital after − before`, i.e. the exact applied swing.
- Commitments are created in a later phase, so a probe answered in the *declaration* quarter
  cannot be in `commitmentRegister` yet ⇒ no `CommitmentTestRecord` ⇒ no ledger row, status stays
  STANDING (`src/engine/commitments.ts:33` now filters `state.analytics.commitmentTests`).
- `src/components/Debrief.tsx:295-330` — "Commitment ledger" panel: `You never tied your hands, so
  nothing could be honored or broken.` when the register is empty; otherwise per commitment a
  title + status tag + `commitmentSummary` sentence + table
  Quarter / Provocation / Floor / Your response / Verdict / **PC change**.
- `src/components/Debrief.tsx:145-151` — Credibility sub-rows "Commitment discipline" and
  "Rationale coherence", the latter printing `n/a` when `score.coherence === null`.
- `src/components/Sitrep.tsx:60-77` — "Commitment register" lists ALL commitments with the status
  tag and `commitmentSummary`.
- Content: `sig_redline` 1 budget / 3 PC, floor **MATCH**, scope `frontier`, backDown 4;
  `sig_tripwire_treaty` 2 budget / 4 PC, floor **ENFORCE**, scope `frontier`+`maritime`, backDown 6.
  Probes: `probe_fishing` "Grey-Hull Fishing Fleet" = maritime only; `probe_incursion` "Frontier Air
  Incursion" and `probe_seizure` "Disputed Feature Seizure" = frontier; `probe_blockade` "Customs
  Quarantine" = maritime+frontier. Probe rationales are only rs_probe
  (proportionate/firmness/restraint) and are optional (`ProbeResponse.tsx:96` gates Continue on the
  rung only). `inv_ready_1` "Readiness: Logistics & Sustainment" 5 budget, rs_capability.
- UI path per quarter: SITREP "Continue" → Probe response (rung, rationale, "Continue") →
  Signals & investments (card Rationale dropdown, "Stage", "Review & resolve") → "Resolve quarter"
  → "Next quarter". Long runs driven by `/tmp/drive.js` clicking the same visible buttons.

## Run A — scenario 1: standing, same-quarter phantom check, honored, coherent audit, intel
Q1: stage **MATCH** + "Firmness now prevents salami-slicing later."; buy `sig_redline`
(rationale "Protect our reputation for honoring commitments."), `sig_tripwire_treaty` (same
rationale), `inv_intel_1` ISR Expansion (rationale "Hedge against worsening intelligence.") and
`inv_ready_1` (rationale "Deny the Rival a fait accompli." — deliberately a denial reason on a
readiness card). Resolve.
- **A1 (new check b)**: Q1's probe is the maritime "Grey-Hull Fishing Fleet" answered MATCH, which
  is *below* the tripwire's ENFORCE floor. On the Q2 SITREP both commitments must read **STANDING**
  and the tripwire must NOT claim a test. A BROKEN tripwire, or a Q1 row in the debrief ledger for
  either commitment, is a fail (that is the phantom-row bug).
- **A2 (item 2, standing)**: Q2 SITREP register shows for the red line: status **STANDING** and the
  sentence "You promised at least MATCH against frontier provocations. No in-scope provocation has
  tested it yet, so it costs 1 PC per quarter to keep standing." Tripwire shows scope
  "frontier or maritime" and floor ENFORCE (item 6, two-tag scope). Screenshot.
- **A3 (item 3, honored)**: from Q2 answer **ENFORCE** + firmness every quarter. The next maritime
  or frontier probe must flip the relevant commitment's register tag to **HONORED** with the
  sentence "... Tested once and kept — most recently <probe title> in Q<n>, answered with ENFORCE."
  Screenshot the SITREP register in the quarter after the honor.
- **A4 (PR #16 leftover)**: Q3 SITREP posture Intelligence reads **3** (from 1), intel tags read
  **MODERATE confidence** and the why-line "...intelligence is at 3/10 — ... about ±17 points...".
  Buy `inv_intel_2` Fusion Cell (needs intel ≥3) with the hedge rationale; when it lands, posture
  Intelligence reads **6**, why-line "±12", tag still **MODERATE** ⇒ report HIGH as empirically
  unreachable (needs σ<0.10 ⇒ level ≥8; no card above 6).
- Play to an ending with the driver (ENFORCE + firmness).
- **A5 (debrief ledger, honored)**: ledger shows a row per test with Quarter, Provocation, Floor,
  "Your response" ENFORCE, Verdict **HONORED**, **PC change +2**; no row dated Q1. Screenshot.
- **A6 (#17/#18 coherent)**: Rationale audit shows probe rows CONSISTENT ("Firmness claimed,
  firmness delivered."), the ISR row CONSISTENT, the two commitment-card rows CONSISTENT
  (reputation on a commitment card), and the `inv_ready_1` row **UNSCORED** — a MISMATCH there is a
  fail of #18. Summary reads "0 of M ... contradicted their stated reason" with M = count of
  non-UNSCORED rows, counted from the rendered table.
- **A7**: "Rationale coherence" reads **100.0** and Credibility ≈ 0.7·discipline + 0.3·100
  (arithmetic on the printed numbers, ±0.15). Composite prints `N / 100`; salami/signal audits and
  all three charts render.

## Run B — scenario 3: broken commitment + incoherent audit + narrow layout
New game, scenario 3. Q1: stage **CONCEDE** + firmness; buy `sig_redline` (reputation) and
`sig_statement` "Public Statement of Concern" (rationale "Demonstrate resolve to deter probing.").
Resolve, then CONCEDE + firmness every quarter to the ending (CAPITULATION ≈ Q12) via the driver.
- **B1 (item 4, broken)**: the first frontier-tagged probe after Q1 (Customs Quarantine once the
  concession streak ≥2, or Frontier Air Incursion) must flip the red line to **BROKEN** with the
  sentence "... You broke it in Q<n>: <probe title> came in and you chose CONCEDE, below the
  floor." Screenshot the SITREP register while BROKEN.
- **B2 (new check a + item 4)**: the debrief ledger shows exactly one row for the red line, with
  Verdict **BROKEN** and a **negative** "PC change" (sign only; magnitude may be < 4 because PC
  clamps at 0). No row exists for any later frontier probe. Screenshot.
- **B3 (#17)**: Rationale audit shows the Q1 signal row "Public Statement of Concern" /
  "Demonstrate resolve to deter probing." / **MISMATCH** / "Deterrence by cheap talk: the Rival
  discounts it.", and one MISMATCH per CONCEDE probe with "Claimed firmness prevents salami-slicing,
  then gave ground."; quarter numbers match the salami audit's quarters for the same probes.
- **B4**: the summary line's two numbers equal the counts of MISMATCH rows / non-UNSCORED rows in
  the rendered table; "Rationale coherence" reads **0.0** and Credibility ≈ 0.7·discipline
  (a credibility equal to discipline here would mean coherence is not wired into scoring).
- **B5 (styling/layout)**: MISMATCH/BROKEN tags render in the red accent, HONORED in green; then
  resize the window to ~820px wide and confirm the ledger + audit tables stay inside their panels,
  long Reading text wraps, and the panels below keep their order. Screenshot narrow view.

## Run C — no commitments, no rationales
New game, scenario 3: CONCEDE every probe, **never** pick a rationale, buy nothing, to the ending.
- **C1 (item 5)**: debrief Commitment ledger reads "You never tied your hands, so nothing could be
  honored or broken." with no empty table.
- **C2 (#18)**: "Rationale coherence" reads **n/a** and Credibility equals Commitment discipline
  to one decimal; the Rationale audit says "No justified decisions were logged."

## Console
After the initial hard reload, read the console at the end of each run: zero errors and zero
warnings; only `[vite] connected` / React DevTools info lines are acceptable. HMR lines would mean
the tree moved and the run is void.
