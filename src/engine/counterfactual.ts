// ============================================================================
// Counterfactual engine (PRD §6.12) — the signature deliverable. Re-runs the
// pure resolver against the same seed under authored policy profiles, sub-seeded
// pivots, and type-swap projections. Policies are content (decision tables over
// the DSL); this module is the runner. Pure (AC-2).
// ============================================================================

import type {
  ContentPack,
  GameState,
  PolicyProfile,
  ResponseType,
  RivalType,
  TurnDecisions,
} from './types';
import { RIVAL_TYPES, RESPONSE_ORDINAL } from './types';
import { resolveTurn, resolveEpilogueTurn } from './resolver';
import { createInitialState } from './setup';
import { buildPlayerVars } from './context';
import { evalBool } from './conditions';
import { hash32 } from './rng';
import { hashState, outcomeValue } from './analytics';

// Fixed timestamp for counterfactual runs so hashes are stable.
const CF_CREATED_AT = '1970-01-01T00:00:00.000Z';

export type OutcomeState = 'PEACE' | 'CRISIS' | 'WAR' | 'CAPITULATION';

export type DecideFn = (state: GameState) => TurnDecisions;

export interface RunResult {
  finalState: GameState;
  lattice: OutcomeState[];
  outcome: number;
  ending: GameState['meta']['ending'];
  hash: string;
}

// --- Epilogue auto-decision (pick best effective delta) ---------------------

function epilogueDecide(state: GameState, content: ContentPack): TurnDecisions {
  const eTurn = state.meta.epilogueTurn ?? 1;
  const decision = content.epilogue.decisions[eTurn - 1];
  if (!decision) return { turn: state.meta.turnNumber, purchases: [] };
  let best = decision.options[0];
  let bestVal = -Infinity;
  for (const o of decision.options) {
    let v = o.outcomeDelta;
    if (o.terminationLeverage) {
      v += Math.max(0, state.player.tracks.punishment - 3);
    }
    if (v > bestVal) {
      bestVal = v;
      best = o;
    }
  }
  return {
    turn: state.meta.turnNumber,
    purchases: [],
    epilogueChoice: { decisionId: decision.id, optionId: best.id },
  };
}

// --- Core game runner -------------------------------------------------------

export interface PlayOptions {
  typeOverride?: RivalType;
  // Install sub-seed stream overrides when reaching this turn (k > 0).
  pivot?: { turn: number; k: number; pivotId: string };
}

function installSubSeed(state: GameState, pivotId: string, k: number): void {
  if (k <= 0) return; // k = 0 continues the original streams
  state.rng.streamSeeds = {
    rival: hash32(state.meta.seed, pivotId, k, 'rival'),
    probes: hash32(state.meta.seed, pivotId, k, 'probes'),
    events: hash32(state.meta.seed, pivotId, k, 'events'),
    intel: hash32(state.meta.seed, pivotId, k, 'intel'),
    epilogue: hash32(state.meta.seed, pivotId, k, 'epilogue'),
  };
  state.rng.streamCursors = { rival: 0, probes: 0, events: 0, intel: 0, epilogue: 0 };
}

export function playGame(
  content: ContentPack,
  seed: number,
  decide: DecideFn,
  opts: PlayOptions = {},
): RunResult {
  // Type-swap runs prime the opening (probe/intel/correspondence) under the
  // overridden type, so the counterfactual is a true "what if the Rival had
  // been type X from the start" simulation rather than a mid-game swap.
  let s = createInitialState(content, seed, CF_CREATED_AT, undefined, opts.typeOverride);

  let guard = 0;
  while (s.meta.phase !== 'DEBRIEF' && guard < content.scenario.turnCount + 12) {
    guard++;
    if (s.meta.phase === 'EPILOGUE') {
      s = resolveEpilogueTurn(s, epilogueDecide(s, content), content);
      continue;
    }
    // Pre-war turn. Install sub-seed at the pivot boundary before resolving it.
    if (opts.pivot && s.meta.turnNumber === opts.pivot.turn && opts.pivot.k > 0) {
      installSubSeed(s, opts.pivot.pivotId, opts.pivot.k);
    }
    const decisions = decide(s);
    s = resolveTurn(s, decisions, content);
  }

  return {
    finalState: s,
    lattice: computeLattice(s, content.scenario.turnCount),
    outcome: outcomeValue(s),
    ending: s.meta.ending,
    hash: hashState(s),
  };
}

// --- Lattice per-turn outcome state -----------------------------------------

export function computeLattice(state: GameState, turnCount: number): OutcomeState[] {
  const lattice: OutcomeState[] = [];
  const records = state.analytics.turnRecords;
  let terminal: OutcomeState | null = null;
  for (let t = 0; t < turnCount; t++) {
    if (terminal) {
      lattice.push(terminal);
      continue;
    }
    const rec = records.find((r) => r.turn === t);
    if (!rec) {
      lattice.push('PEACE');
      continue;
    }
    if (rec.endingAfter === 'WAR') {
      lattice.push('WAR');
      terminal = 'WAR';
      continue;
    }
    if (rec.endingAfter === 'CAPITULATION') {
      lattice.push('CAPITULATION');
      terminal = 'CAPITULATION';
      continue;
    }
    const probe = rec.probeId
      ? state.world.probeLog.find((p) => p.turn === t && p.probeId === rec.probeId)
      : undefined;
    const crisis =
      (probe && probe.severity >= 3) ||
      rec.deltas.statusQuoIntegrity <= -3 ||
      rec.concessionStreak >= 2;
    lattice.push(crisis ? 'CRISIS' : 'PEACE');
  }
  return lattice;
}

// --- Decision functions -----------------------------------------------------

// Replay/projection of a recorded decision stream (P1_ACTUAL / P1_PROJECTED).
export function makeProjectedDecide(
  recorded: TurnDecisions[],
  content: ContentPack,
  pivotOverride?: { turn: number; response: ResponseType },
): DecideFn {
  return (state: GameState): TurnDecisions => {
    const turn = state.meta.turnNumber;
    const rec = recorded.find((d) => d.turn === turn);
    const decisions: TurnDecisions = { turn, purchases: [] };

    // Probe response.
    if (state.world.stagedProbeId) {
      let responseType: ResponseType = 'MATCH';
      if (rec?.probeResponse) responseType = rec.probeResponse.responseType;
      if (pivotOverride && pivotOverride.turn === turn) responseType = pivotOverride.response;
      decisions.probeResponse = {
        probeId: state.world.stagedProbeId,
        responseType,
        rationaleId: rec?.probeResponse?.rationaleId ?? 'auto',
      };
    }

    // Purchases: replay verbatim, skipping any the projection cannot afford.
    if (rec) {
      let budget = state.player.budget;
      let pc = state.player.politicalCapital;
      for (const p of rec.purchases) {
        const card = content.cardsById[p.cardId];
        if (!card) continue;
        if (card.cost.budget > budget || card.cost.politicalCapital > pc) continue;
        const count = state.player.purchaseCounts[card.id] ?? 0;
        if (card.maxPurchases !== undefined && count >= card.maxPurchases) continue;
        budget -= card.cost.budget;
        pc -= card.cost.politicalCapital;
        decisions.purchases.push({ cardId: p.cardId, rationaleId: p.rationaleId });
      }
      if (rec.typeBelief) decisions.typeBelief = rec.typeBelief;
      if (rec.inboxResponses) {
        decisions.inboxResponses = rec.inboxResponses.filter((r) =>
          state.world.inbox.some((m) => m.id === r.messageId),
        );
      }
    }
    return decisions;
  };
}

// Policy-profile decision function (P2..P5).
export function makePolicyDecide(profile: PolicyProfile, content: ContentPack): DecideFn {
  return (state: GameState): TurnDecisions => {
    const turn = state.meta.turnNumber;
    const decisions: TurnDecisions = { turn, purchases: [] };
    // Policies are executable player doctrines, not oracles: both their probe
    // rules and their buy conditions read PLAYER_CONTEXT only (no hidden ledgers),
    // so the strategy lattice is an honest "what if you'd followed this doctrine".
    const playerVars = buildPlayerVars(state, content);

    if (state.world.stagedProbeId) {
      let responseType = profile.probeResponse.default;
      for (const rule of profile.probeResponse.rules ?? []) {
        if (evalBool(rule.condition, playerVars)) {
          responseType = rule.responseType;
          break;
        }
      }
      decisions.probeResponse = {
        probeId: state.world.stagedProbeId,
        responseType,
        rationaleId: 'auto',
      };
    }

    let budget = state.player.budget;
    let pc = state.player.politicalCapital;
    for (const buy of profile.purchasePlan.buys) {
      const card = content.cardsById[buy.cardId];
      if (!card) continue;
      if (buy.condition && !evalBool(buy.condition, playerVars)) continue;
      if (card.cost.budget > budget || card.cost.politicalCapital > pc) continue;
      const count = state.player.purchaseCounts[card.id] ?? 0;
      if (card.maxPurchases !== undefined && count >= card.maxPurchases) continue;
      const last = state.player.lastPurchaseTurn[card.id];
      if (card.cooldownTurns !== undefined && last !== undefined && turn - last < card.cooldownTurns) {
        continue;
      }
      budget -= card.cost.budget;
      pc -= card.cost.politicalCapital;
      decisions.purchases.push({ cardId: card.id, rationaleId: 'auto' });
    }

    if (profile.typeBelief && turn % 4 === 0) {
      decisions.typeBelief = { statedType: profile.typeBelief };
    }
    return decisions;
  };
}

// --- Pivot identification ---------------------------------------------------

export interface Pivot {
  pivotId: string;
  turn: number;
  swing: number;
}

export function identifyPivots(
  state: GameState,
  maxPivots: number,
  eligibleTurns?: Set<number>,
): Pivot[] {
  const hist = state.analytics.perceptionHistory;
  const swings: Pivot[] = [];
  for (let i = 1; i < hist.length; i++) {
    // A pivot must land on a quarter the player actually faced a probe —
    // otherwise flipping the "response" is a no-op and the sub-runs would
    // differ only by exogenous reseed noise, not a genuine counterfactual.
    if (eligibleTurns && !eligibleTurns.has(hist[i].turn)) continue;
    const swing = Math.abs(hist[i].warUtility - hist[i - 1].warUtility);
    swings.push({ pivotId: `pivot_t${hist[i].turn}`, turn: hist[i].turn, swing });
  }
  swings.sort((a, b) => b.swing - a.swing || a.turn - b.turn);
  return swings.slice(0, maxPivots);
}

// --- Full debrief report ----------------------------------------------------

export interface PivotRow {
  pivot: Pivot;
  // The recorded response at the pivot turn and the counterfactual alternative
  // that was played instead, across the sub-seeds.
  recordedResponse: ResponseType;
  altResponse: ResponseType;
  // Lattice per sub-seed; modal outcome and agreement across sub-seeds.
  subRuns: RunResult[];
  modalEnding: GameState['meta']['ending'];
  agreement: number; // count matching modal / total
  lattice: OutcomeState[]; // modal sub-run's lattice
}

export interface CounterfactualReport {
  actual: RunResult;
  policies: { profile: PolicyProfile; run: RunResult }[];
  pivots: PivotRow[];
  typeSwaps: { type: RivalType; run: RunResult }[];
  robustness01: number;
  reSimCount: number;
}

// The pivot's authored alternative: flip the recorded response to its opposite
// end of the ordinal scale to create a meaningful, deterministic swing.
function alternativeResponse(recorded: TurnDecisions[], turn: number): ResponseType {
  const rec = recorded.find((d) => d.turn === turn)?.probeResponse;
  const cur = rec?.responseType ?? 'CONCEDE';
  return RESPONSE_ORDINAL[cur] <= RESPONSE_ORDINAL.MATCH ? 'ENFORCE' : 'CONCEDE';
}

export function runCounterfactualReport(
  content: ContentPack,
  seed: number,
  recorded: TurnDecisions[],
  actualType: RivalType,
): CounterfactualReport {
  const tuning = content.scenario.tuning;

  // Identity re-run (P1_ACTUAL).
  const actual = playGame(content, seed, makeProjectedDecide(recorded, content));

  // Policy profiles P2..P5.
  const policies = content.policies.map((profile) => ({
    profile,
    run: playGame(content, seed, makePolicyDecide(profile, content)),
  }));

  // Pivots × sub-seeds. Only quarters with a recorded probe response are
  // eligible — flipping a response on a probe-free quarter would be a no-op.
  const probeTurns = new Set(
    recorded.filter((d) => d.probeResponse).map((d) => d.turn),
  );
  const pivotList = identifyPivots(actual.finalState, tuning.maxPivots, probeTurns);
  const pivots: PivotRow[] = pivotList.map((pivot) => {
    const alt = alternativeResponse(recorded, pivot.turn);
    const recordedResponse =
      recorded.find((d) => d.turn === pivot.turn)?.probeResponse?.responseType ?? 'CONCEDE';
    const subRuns: RunResult[] = [];
    for (let k = 0; k < tuning.pivotSubSeeds; k++) {
      subRuns.push(
        playGame(content, seed, makeProjectedDecide(recorded, content, { turn: pivot.turn, response: alt }), {
          pivot: { turn: pivot.turn, k, pivotId: pivot.pivotId },
        }),
      );
    }
    // Modal ending across sub-seeds.
    const counts = new Map<string, number>();
    for (const r of subRuns) counts.set(String(r.ending), (counts.get(String(r.ending)) ?? 0) + 1);
    let modal = subRuns[0].ending;
    let modalCount = 0;
    for (const [k, c] of counts) {
      if (c > modalCount) {
        modalCount = c;
        modal = (k === 'null' ? null : (k as GameState['meta']['ending']));
      }
    }
    const modalRun = subRuns.find((r) => String(r.ending) === String(modal)) ?? subRuns[0];
    return {
      pivot,
      recordedResponse,
      altResponse: alt,
      subRuns,
      modalEnding: modal,
      agreement: modalCount / subRuns.length,
      lattice: modalRun.lattice,
    };
  });

  // Type-swap robustness runs (the other two types), P1_PROJECTED.
  const otherTypes = RIVAL_TYPES.filter((t) => t !== actualType);
  const typeSwaps = otherTypes.map((type) => ({
    type,
    run: playGame(content, seed, makeProjectedDecide(recorded, content), { typeOverride: type }),
  }));
  const robustness01 =
    typeSwaps.reduce((s, ts) => s + ts.run.outcome / 100, 0) / Math.max(1, typeSwaps.length);

  const reSimCount = 1 + policies.length + pivots.length * tuning.pivotSubSeeds + typeSwaps.length;

  return { actual, policies, pivots, typeSwaps, robustness01, reSimCount };
}
