# The Red Line — Critical Technical Review

Reviewed at commit `03a6837` (branch `main`), 2026-07-19. Scope: full source
(~6,800 LoC TS/TSX), content pipeline, tests, CI. All claims marked
**[verified]** were confirmed by executing code in this review; items marked
**[inference]** are judgments from reading.

## Verdict

This is a well-above-average codebase for an AI-built project. The core
architectural decisions are genuinely good and genuinely enforced: a pure,
deterministic engine with lint-level purity guards; event-sourced saves
replayed through that engine; a schema-validated, deep-frozen content pipeline;
and 47 tests that assert meaningful invariants rather than trivia. Lint,
typecheck, content validation, tests, and build all pass **[verified]**.

The weaknesses follow a recognizable agent-built signature: **infrastructure
that overstates what is actually wired up**. The flagship "sub-seeded pivot"
counterfactual analysis is provably vacuous as shipped; several schema features
and tuning knobs are dead; multiple comments promise behavior the code doesn't
implement; and the save system's "tamper-evident" claim has no mechanism behind
it. None of these break normal play — the game runs correctly end-to-end — but
they matter for anyone extending the project, and a few are silent traps for
content authors.

---

## 1. High-impact findings

### 1.1 The pivot sub-seed machinery is degenerate — the game has almost no randomness **[verified]**

The engine declares five RNG streams (`rival`, `probes`, `events`, `intel`,
`epilogue`) with per-stream cursors and a sub-seed override mechanism
(`src/engine/rng.ts`, `src/engine/counterfactual.ts:72`). The only draw in the
entire engine is intel noise — `src/engine/resolver.ts:448`. Probe generation,
events, rival behavior, and the epilogue are fully deterministic rule
evaluations; four of five streams are never consumed.

Consequences:

- The counterfactual debrief's pivot analysis re-runs each pivot under 5
  sub-seeds specifically to measure outcome variance ("agreement"). Since
  reseeding only perturbs intel *display* noise — which no decision function
  reads — all sub-runs are behaviorally identical. Measured on scenario-1,
  seed 1337: 6 pivots × 5 sub-seeds, every row `agreement=1.0`, 1 distinct
  ending, 1 distinct lattice. The statistic is always 100% by construction.
- 30 of the 37 debrief re-simulations are therefore redundant compute.
- `report.pivots` is **never rendered** — no UI consumes it (only the inflated
  `reSimCount` is displayed in `Debrief.tsx:205`). The counterfactual module
  header calls this "the signature deliverable"; a third of it is dead weight.
- The `scenario.beats` min/max windows imply events land at a random turn in a
  window — presumably what the `events` stream was for. As written, an
  unconditional event always fires the turn its window opens
  (`resolver.ts:366-381`), so `maxTurn` is inert for those events.

Fix directions: either wire real draws into probe variant/rule selection and
beat timing (restoring meaning to sub-seeded pivots, then actually render
them), or delete the stream/sub-seed machinery and pivot computation and let
the debrief honestly claim its ~7 meaningful re-simulations.

### 1.2 The engine trusts probe-response decisions it should validate **[verified]**

`phaseProbeResponse` (`src/engine/resolver.ts:73-83`) initializes
`responseType` from the decision *before* checking that the decision's
`probeId` matches the staged probe, and never checks that the response type is
among the probe's authored options. Confirmed by execution: a decision naming a
*different* probe with `ESCALATE` is applied to the staged probe as ESCALATE
instead of being treated as inaction (CONCEDE, per the code's own comment).
`rationaleId` is likewise recorded verbatim, unvalidated.

The purchase path explicitly defends against illegal inputs ("the engine, not
just the caller, refuses" — `resolver.ts:167-170`); the probe path doesn't.
This is exploitable only via a hand-edited save (single-player, low severity),
but it breaks the engine's own stated defensive posture, and a corrupted or
version-skewed decision log will silently mis-replay rather than fail.

### 1.3 Save compatibility: version recorded, never checked; no golden master **[verified]**

- `SaveGame.schemaVersion` is written but `loadSave`/`replay`
  (`src/store/persistence.ts:41-83`) never inspect it. Any engine or content
  change silently alters what an old decision log replays into — the resumed
  game can differ from the one the player left, with no warning.
- The determinism suite compares two in-process runs; no expected hash is
  pinned in the repo. Cross-version drift — the thing that actually corrupts
  saves — is undetected by CI. The header comments call this "golden-master"
  hashing (`src/engine/hash.ts:3`), but no golden master exists.
- The persistence header claims saves are "tamper-evident"
  (`persistence.ts:5`). There is no integrity mechanism of any kind. The claim
  should be deleted or implemented (e.g., store `hashState` at save time and
  compare after replay — the primitive already exists).

### 1.4 Content authoring traps: effects that silently do nothing **[verified]**

`applyEffect` (`src/engine/effects.ts:115-138`):

- A **stock** target (`statusQuoIntegrity`, `budget`, …) with `durationTurns`
  set is routed to the ActiveModifiers list — which nothing ever applies to
  stocks. Confirmed: `{target: statusQuoIntegrity, op: add, value: -10,
  durationTurns: 2}` leaves the value untouched and orphans a modifier.
  Content validation (`src/content-loader/validate.ts:173-187`) accepts it.
  For a pipeline whose stated philosophy is "build fails loudly on invalid
  content" (AC-3), this is exactly the failure mode it promises to prevent.
- `politicalCapital` effects clamp to 0..100 (`effects.ts:44`), not the
  scenario's `pcCap` (20). Every other PC pathway respects the cap. Confirmed:
  a +30 event effect leaves PC at 48. Latent today (the only shipped PC effect
  is negative), but it's a tuning-integrity leak waiting for the first
  PC-granting event.
- Modifier ids are `${sourceId}:${target}` — a repeating event stacks
  duplicate-id modifiers and `flowMultiplier` multiplies them all. Currently
  masked by `maxFires: 1`/cooldowns. **[inference]**
- `durationTurns` semantics are off-by-one-ish: the inbox "task collection"
  option needs `durationTurns: 2` to produce one quarter of boost, because the
  next quarter's intel is generated at the end of the current turn. The
  shipped content is correct; the semantics invite authoring errors.

Recommended: validation should reject `durationTurns` on stock targets and
`add`/`set` flow modifiers nothing reads; `clampTarget` should take the
scenario cap; duration semantics deserve one comment with a worked example.

### 1.5 Dead surface area — promised features that don't exist

All **[verified]** by grep and/or execution:

| Artifact | Status |
|---|---|
| `ProbeCard.perType` weights (`types.ts:191`, probes schema) | Never read; probe choice is rule-priority only |
| `RivalRule.kind: 'ARMING' \| 'PRESSURE'` (`types.ts:223`) | Never evaluated; arming/pressure hardcoded in `advanceRivalInternal`. `rival.ts` header says "three content-defined rule tables" — only PROBE rules exist |
| `ScenarioTuning.unsurePenaltyTurnFraction` (`types.ts:362`, all 3 scenarios) | Never consumed; the UNSURE-penalty concept is unimplemented |
| `analytics.lockInTurn` state field (`types.ts:613`) | Initialized `null`, never written; the real computation is the `lockInTurn()` function |
| `bandResponses` in `makeProjectedDecide` (`counterfactual.ts:166-181`) | Declared, never populated, suppressed with `void bandResponses;` — the "modal response per severity band" fallback described in the comment was never built; fallback is a hardcoded `MATCH` |
| `Meter.tsx` | Never imported |
| `jsdom` devDependency | Unused (vitest env is `node`; no DOM tests exist) |

Individually trivial; collectively they mislead the next maintainer about what
the system does, and they're the strongest tell of unreviewed agent output.

### 1.6 Comment rot — documentation asserting false mechanics

- `pSuccess` claims readiness "nudge[s]" success probability
  (`formulas.ts:28-30`); the function takes only arming and denial. Readiness
  affects lead times and war outcome, not pSuccess.
- `costEstimate` docstring says `g(punishment, resolve)`; resolve is applied
  elsewhere (`warUtility`).
- `EventCard.biasMetric` comment says the metric "gets systematically
  overstated" (`types.ts:245`); the shipped event uses a negative bias
  (understated intent) — code handles both signs, comment wrong.
- The PRESSURED_EXPANSIONIST tell says "late resolve is discounted as the
  window narrows" — mechanically resolve is never time-discounted; gain grows
  with pressure. Similar player-facing effect, different mechanism.
  **[inference]**
- `epilogueDecide` (counterfactual auto-play) approximates termination
  leverage as `punishment - 3` rather than the resolver's
  `terminationPerLevelAbove3`-scaled, capped formula — policies can mis-rank
  epilogue options if tuning diverges from the current values. **[inference]**

---

## 2. Moderate findings

### 2.1 Debrief runs 37 full re-simulations synchronously on the render thread

`useDebrief` (`src/ui/useDebrief.ts:34`) computes the whole report inside
`useMemo`. Measured (Node, this machine): ~200-220 ms for a 15-turn WAR
campaign, ~470-590 ms for a 32-turn campaign **[verified]**; a low-end
browser device plausibly blocks 1-3 s **[inference]**. Each simulated turn
`structuredClone`s a state whose embedded logs grow linearly (intel 4/turn,
inbox up to 4/turn), so cost is superlinear in turn count. Dropping the
redundant pivot runs (§1.1) removes ~80% of it; a Web Worker or chunked
computation with a loading state would fix the rest. React StrictMode also
double-invokes this memo in dev.

### 2.2 The UI understates escalated probes

When the concession streak triggers salami escalation, the engine resolves the
probe at `severity + 1` and `salamiValue × 1.5` (`resolver.ts:68-70`), but
SITREP and the response screen display the base severity
(`Sitrep.tsx:91`, `ProbeResponse.tsx:62`). The player is warned a streak
exists but never sees the actual stakes of the staged probe. For a game whose
pedagogy is "understand what your concessions cost," showing pre-escalation
numbers undercuts the lesson.

### 2.3 Debrief metrics with unit/attribution problems

- `cumulativeSpend` adds budget and political capital as one number
  (`resolver.ts:192`), and `efficiencyScore` divides that mixed sum by a
  budget-only reference (`analytics.ts:133-141`). PC-heavy strategies are
  penalized on a currency they never drew from the reference pool.
- `signalAudit` attributes the *entire turn's* resolve delta (including decay,
  probe response, and every other signal that quarter) to each signal row
  (`analytics.ts:180-195`); the debrief table header ("Resolve read Δ")
  presents it as per-signal effect.
- `salamiAudit` hardcodes a starting integrity of 100 (`analytics.ts:155`)
  rather than the scenario's opening value, and replays probe deltas only —
  its "Remaining" column diverges from true integrity if events touch SQ or a
  scenario opens below 100. Latent with current content.
- `credibilityScore` counts never-tested STANDING commitments as un-honored
  and additionally subtracts per back-down, double-penalizing broken ones
  (`analytics.ts:121-129`). Defensible design, but worth an explicit decision.

### 2.4 No error containment

There is no React error boundary, and `writeSave`'s `setItem` calls
(`persistence.ts:88-91`) are outside the try/catch that guards storage
*access*. A `QuotaExceededError` mid-campaign propagates out of `commitTurn`:
the turn silently fails from the player's perspective (state update is
skipped). A render-time throw unmounts the app to a blank page. One boundary
plus a guarded write with a visible "save failed" path would cover it.

### 2.5 Accessibility gaps (Section 508 / WCAG — default requirement)

Solid baseline: global `:focus-visible` outline, tooltips shown on
`:focus-within`, `role="img"` labels on charts, text alternatives beside the
intel bars, `aria-live` quiz progress, `<main>` landmarks on several screens.
Gaps, in rough priority order:

1. **Custom radio groups without radio keyboard behavior** — probe ladder,
   scenario picker, hypothesis picker use `role="radio"` buttons with no
   roving tabindex/arrow-key support (ARIA APG violation; operable via Tab but
   announced semantics don't match interaction).
2. **Hover-only tooltips on non-focusable elements** — HUD track chips wrap
   plain `<span>`s in `Tooltip`; keyboard users cannot summon them (WCAG
   2.1.1), and no tooltip is Esc-dismissible (1.4.13). `role="tooltip"` is
   never linked via `aria-describedby`.
3. **Guided tour dialog** (`GuidedTour.tsx:191`) sets `aria-modal="true"` with
   no focus trap and no initial focus move (2.4.3); background remains
   tab-reachable.
4. **Stage transitions neither move focus nor announce** — committing a
   quarter swaps the whole screen while focus dies on an unmounted button;
   screen-reader users get no signal the Resolution screen exists (4.1.3).
5. Recharts output has no non-visual data alternative (a table fallback for
   the perception replay would do); dark-theme contrast (e.g., muted
   `#7c8aa5`-family text) has not been audited — unverified, recommend a pass;
   no `prefers-reduced-motion` handling (minor; few animations).

### 2.6 Bundle and toolchain

- Production bundle is one 813 kB chunk (239 kB gzip) **[verified]** — Vite
  itself warns. Recharts (plus its d3 tree) serves two modest charts, and Ajv
  ships to the browser to re-validate content that CI already validated at
  build time. Code-splitting the debrief (sole Recharts consumer) or
  pre-assembling validated content at build would cut this substantially.
- `npm audit`: production dependencies clean (0 advisories); dev chain has 5
  (3 moderate, 1 high, 1 critical) via the pinned old `vite@5.4.2` /
  `vitest@2.0.5` / `esbuild≤0.24.2` line (e.g., GHSA-67mh-4wv8-2f99, dev-server
  only) **[verified]**. Not runtime-exposed; still worth an upgrade cycle,
  which will also unblock ESLint ≥9 (repo is on 8.57 legacy config).
- Licensing: all runtime deps (react, react-dom, zustand, recharts, ajv,
  ajv-formats) are MIT — no copyleft exposure **[verified via package
  metadata]**.
- `structuredClone` and ES2020 targets set an implicit 2022+ browser floor; no
  browserslist or fallback is declared. **[inference]**

### 2.7 CI/CD: the auto-merge pipeline has no human gate

`automerge.yml` squash-merges any PR authored by the owner or the Devin bot
once CI succeeds. The workflow itself is protected (runs from the default
branch on `workflow_run`), but **`ci.yml` is not** — a PR can edit the CI
workflow, trivially pass its own gutted checks, and be auto-merged with
`contents: write`. For a solo educational repo this is a deliberate
convenience; it still means bot-authored code reaches `main` with zero human
review and a self-attesting quality gate. Cheap hardening: branch protection
with required named checks (so a renamed/emptied workflow doesn't satisfy
them), and/or restrict auto-merge to the label path so a human applies the
label per PR.

---

## 3. What is genuinely good

Credit where due — these are the reasons the codebase is trustworthy at its
core, and all were verified rather than taken on faith:

1. **Purity is enforced, not aspirational.** ESLint bans `Date`,
   `Math.random`, `fetch`, storage, and UI imports inside `src/engine`;
   tests assert input-state immutability and referential transparency; the
   clock and storage live only in the store. The one RNG is seeded and
   counter-based, so replays are exact.
2. **Event-sourced saves are the right design** for a deterministic game:
   tiny saves, resume-by-replay, verified bit-identical across all three
   endings in tests.
3. **The content pipeline is disciplined.** Ajv 2020 structural validation +
   DSL operator/variable whitelists per evaluation context + referential
   integrity + reachability checks + deep-freeze, shared between CI script and
   browser loader. The condition DSL is a real interpreter with no `eval` and
   a test proving hidden-ledger variables can't leak into player-facing
   contexts.
4. **Tests assert the things that matter for a serious game**: all endings
   reachable; the same hard-line policy deters the Opportunist but provokes
   the Security Seeker to war (the game's core lesson, as an executable
   invariant); hidden type never serialized into player-visible intel; a
   regression guard encoding a previous external review finding.
5. **Runtime security posture is clean**: no network calls, no
   `dangerouslySetInnerHTML`/`eval`, no secrets in the repo, React-escaped
   rendering throughout, vendored public-domain primitives (xmur3, mulberry32,
   SHA-256) used non-cryptographically **[verified]**.
6. **The theory content is honest.** No fabricated citations — concepts are
   described generically (costly signals, audience costs, denial vs.
   punishment, security dilemma) and the mechanics genuinely implement them
   (tied-hands credibility decays with effective back-downs; reassurance
   lowers threat perception at a resolve cost; salami escalation on
   concession streaks). Fictional states throughout.

## 4. Structural observations

- **Three scenarios share one content library** and differ only in
  scenario.json tuning/pins — honest efficiency, but "3 scenarios" is one
  campaign at three difficulty/type framings. The seed→type pins cover seeds
  1-3 only; scenario-2 pins seed 2 but its default seed (2718) hashes freely.
- **UI duplicates engine eligibility rules** (`SignalsInvestment.tsx:47-59`
  mirrors `resolver.ts:167-181`) — acknowledged in a comment; extracting one
  shared `checkEligibility` would remove the drift risk.
- **Decision `turn` fields are never validated** against the state's turn in
  `resolveTurn`/`replay` — a reordered log replays without complaint.
- **No learner telemetry.** Scores, belief trajectories, and lattices exist
  only inside localStorage. If this is destined for instructional deployment,
  an xAPI/cmi5 export of the debrief record is the natural seam (the analytics
  module already computes everything a statement would need). Product gap,
  not a defect.

## 5. Priority recommendations

1. **Decide what the pivot system is** (§1.1): implement real gameplay
   randomness + render pivots, or delete sub-seeding and its 30 redundant
   re-sims. Current state is misleading compute.
2. **Close the engine trust gaps** (§1.2): validate probe decision against the
   staged probe and its option set; validate rationale ids; consider
   validating `decisions.turn`.
3. **Make saves survive change** (§1.3): check `schemaVersion` on load (offer
   restart-or-discard), pin a golden-master hash per scenario in the test
   suite.
4. **Harden effect validation** (§1.4): reject inert effect shapes at content
   load; clamp PC effects to `pcCap`.
5. **Contain failures** (§2.4): error boundary + guarded saves with visible
   failure.
6. **Accessibility pass** (§2.5): radio keyboard pattern, focusable/dismissible
   tooltips, tour focus trap, focus management on stage change.
7. **Show escalated probe stakes in the UI** (§2.2).
8. **Trim the dead surface** (§1.5) and fix rotten comments (§1.6) — cheap,
   high leverage for maintainability.
9. Move the debrief computation off the render path (§2.1); split the bundle
   (§2.6); upgrade the dev toolchain; add a human gate or protected required
   checks to auto-merge (§2.7).
