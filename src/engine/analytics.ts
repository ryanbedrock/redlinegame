// ============================================================================
// Analytics + scoring (PRD §6.13, §10) and the golden-master state hash
// (AC-1/AC-6/AC-9). Pure module: deterministic functions over GameState.
// ============================================================================

import type { ContentPack, GameState, RivalType, SignalClass } from './types';
import { clamp } from './formulas';
import { sha256, stableStringify } from './hash';

// Canonical state hash. Excludes volatile presentation-only meta fields so the
// same event stream always hashes identically regardless of wall-clock or name.
export function hashState(state: GameState): string {
  const clone = structuredClone(state);
  clone.meta.createdAt = '';
  delete clone.meta.displayName;
  return sha256(stableStringify(clone));
}

// --- Outcome ---------------------------------------------------------------

// Map any ending to a 0–100 outcome value for banding/scoring.
export function outcomeValue(state: GameState): number {
  if (state.meta.ending === 'WAR') {
    return state.epilogue?.finalOutcome ?? state.epilogue?.warOutcomeBase ?? 30;
  }
  if (state.meta.ending === 'DETERRENCE_HOLD') {
    return clamp(70 + 0.3 * state.world.statusQuoIntegrity, 0, 100);
  }
  if (state.meta.ending === 'CAPITULATION') {
    return clamp(state.world.statusQuoIntegrity, 0, 20);
  }
  return clamp(state.world.statusQuoIntegrity, 0, 100);
}

export function outcomeBand(
  state: GameState,
  content: ContentPack,
): { label: string; points: number; value: number } {
  const value = outcomeValue(state);
  const bands = [...content.scenario.scoring.outcomeBands].sort(
    (a, b) => b.minOutcome - a.minOutcome,
  );
  for (const band of bands) {
    if (value >= band.minOutcome) return { label: band.label, points: band.points, value };
  }
  const last = bands[bands.length - 1];
  return { label: last.label, points: last.points, value };
}

// --- Diagnosis quality ------------------------------------------------------

export interface BeliefTrajectory {
  turnsToFirstCorrect: number | null;
  flipFlops: number;
  beliefAtLockIn: RivalType | 'UNSURE' | null;
  score: number; // 0..1
}

export function lockInTurn(state: GameState): number | null {
  const total = state.analytics.decisions.reduce(
    (s, d) => s + d.cost.budget + d.cost.politicalCapital,
    0,
  );
  if (total <= 0) return null;
  let cum = 0;
  const byTurn = new Map<number, number>();
  for (const d of state.analytics.decisions) {
    const c = d.cost.budget + d.cost.politicalCapital;
    byTurn.set(d.turn, (byTurn.get(d.turn) ?? 0) + c);
  }
  const turns = [...byTurn.keys()].sort((a, b) => a - b);
  for (const t of turns) {
    cum += byTurn.get(t) ?? 0;
    if (cum >= total * 0.5) return t;
  }
  return turns[turns.length - 1] ?? null;
}

export function beliefTrajectory(
  state: GameState,
  trueType: RivalType,
): BeliefTrajectory {
  const beliefs = state.analytics.typeBeliefs;
  let turnsToFirstCorrect: number | null = null;
  let flipFlops = 0;
  let prev: string | null = null;
  for (const b of beliefs) {
    if (b.statedType === trueType && turnsToFirstCorrect === null) {
      turnsToFirstCorrect = b.turn;
    }
    if (prev !== null && b.statedType !== prev && b.statedType !== 'UNSURE') {
      flipFlops += 1;
    }
    prev = b.statedType;
  }
  const lock = lockInTurn(state);
  let beliefAtLockIn: RivalType | 'UNSURE' | null = null;
  if (lock !== null) {
    const upto = beliefs.filter((b) => b.turn <= lock);
    beliefAtLockIn = upto.length ? upto[upto.length - 1].statedType : null;
  }

  // Score: correct-at-lock-in dominates, plus early correctness, minus flips.
  let score = 0;
  if (beliefAtLockIn === trueType) score += 0.6;
  if (turnsToFirstCorrect !== null) {
    const frac = turnsToFirstCorrect / Math.max(1, state.analytics.turnRecords.length);
    score += 0.4 * (1 - clamp(frac, 0, 1));
  }
  score -= 0.1 * flipFlops;
  return {
    turnsToFirstCorrect,
    flipFlops,
    beliefAtLockIn,
    score: clamp(score, 0, 1),
  };
}

// --- Credibility discipline -------------------------------------------------

export function credibilityScore(state: GameState): number {
  const commitments = state.player.commitmentRegister;
  const made = commitments.length;
  const honored = commitments.filter((c) => c.status === 'HONORED').length;
  let score = 0.6;
  if (made > 0) score = honored / made;
  score -= 0.15 * state.player.backDownCount;
  return clamp(score, 0, 1);
}

// --- Efficiency -------------------------------------------------------------

export function efficiencyScore(state: GameState, content: ContentPack): number {
  const spend = state.analytics.cumulativeSpend;
  const value = outcomeValue(state);
  if (spend <= 0) return value / 100;
  // Outcome value per unit spend, normalized against a reference spend.
  const refSpend = content.scenario.tuning.budgetIncome * content.scenario.turnCount;
  const perUnit = value / 100 / (spend / refSpend);
  return clamp(perUnit, 0, 1);
}

// --- Salami audit -----------------------------------------------------------

export interface SalamiStep {
  turn: number;
  probeId: string;
  responseType: string;
  delta: number;
  cumulativeIntegrity: number;
}

export function salamiAudit(state: GameState): SalamiStep[] {
  const steps: SalamiStep[] = [];
  let integrity = 100;
  for (const p of state.world.probeLog) {
    integrity = clamp(integrity + p.statusQuoDelta, 0, 100);
    steps.push({
      turn: p.turn,
      probeId: p.probeId,
      responseType: p.responseType,
      delta: p.statusQuoDelta,
      cumulativeIntegrity: integrity,
    });
  }
  return steps;
}

// --- Signal audit -----------------------------------------------------------

export interface SignalAuditRow {
  turn: number;
  cardId: string;
  type: SignalClass;
  budget: number;
  politicalCapital: number;
  resolveDelta: number; // resolve change on the turn this signal landed
}

export function signalAudit(state: GameState): SignalAuditRow[] {
  const snaps = new Map(state.analytics.perceptionHistory.map((s) => [s.turn, s]));
  return state.player.signalHistory.map((sig) => {
    const cur = snaps.get(sig.turn);
    const prev = snaps.get(sig.turn - 1);
    const resolveDelta = cur && prev ? cur.perceivedResolve - prev.perceivedResolve : 0;
    return {
      turn: sig.turn,
      cardId: sig.cardId,
      type: sig.type,
      budget: sig.cost.budget,
      politicalCapital: sig.cost.politicalCapital,
      resolveDelta,
    };
  });
}

// --- Composite score --------------------------------------------------------

export interface ScoreBreakdown {
  outcome: number;
  robustness: number;
  diagnosis: number;
  credibility: number;
  efficiency: number;
  composite: number;
  band: string;
}

// robustness01 comes from the counterfactual engine (§6.13, §6.12); 0..1.
export function computeScore(
  state: GameState,
  content: ContentPack,
  robustness01: number,
): ScoreBreakdown {
  const w = content.scenario.scoring.weights;
  const band = outcomeBand(state, content);
  const outcome01 = band.points / 100;
  const diagnosis01 = beliefTrajectory(state, state.rival.type).score;
  const cred01 = credibilityScore(state);
  const eff01 = efficiencyScore(state, content);
  const composite =
    w.outcome * outcome01 +
    w.robustness * robustness01 +
    w.diagnosis * diagnosis01 +
    w.credibility * cred01 +
    w.efficiency * eff01;
  return {
    outcome: outcome01 * 100,
    robustness: robustness01 * 100,
    diagnosis: diagnosis01 * 100,
    credibility: cred01 * 100,
    efficiency: eff01 * 100,
    composite: clamp(composite, 0, 100),
    band: band.label,
  };
}
