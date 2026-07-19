// ============================================================================
// EffectSpec application (Annex A.1). Events and inbox responses carry typed
// effects. "Stock" targets mutate immediately; "flow"/flag targets with a
// duration register ActiveModifiers queried by the resolver. Pure module.
// ============================================================================

import type { EffectSpec, GameState } from './types';
import { clamp, clamp01 } from './formulas';

// Immediate scalar stocks (one-time mutation).
export const STOCK_TARGETS = new Set<string>([
  'budget',
  'politicalCapital',
  'statusQuoIntegrity',
  'threatPerception',
  'internalPressure',
  'perceivedResolve',
  'perceivedCapability',
  'armingLevel',
]);

// Flow targets read multiplicatively via `flowMultiplier` — only `mul`
// modifiers are consumed, so an `add`/`set` modifier here is inert.
export const MULTIPLIER_FLOW_TARGETS = new Set<string>([
  'budgetIncome',
  'audienceCostMultiplier',
]);

// Flag targets read via `flagActive` (active when any modifier's value ≠ 0).
export const FLAG_FLOW_TARGETS = new Set<string>([
  'playerDistractionActive',
  'intelCollectionBoost',
]);

// Duration-based flow/flag targets (registered as ActiveModifiers).
const FLOW_TARGETS = new Set<string>([...MULTIPLIER_FLOW_TARGETS, ...FLAG_FLOW_TARGETS]);

function applyOp(current: number, op: EffectSpec['op'], value: number): number {
  switch (op) {
    case 'add':
      return current + value;
    case 'mul':
      return current * value;
    case 'set':
      return value;
  }
}

function clampTarget(target: string, v: number, pcCap: number): number {
  switch (target) {
    case 'politicalCapital':
      return clamp(v, 0, pcCap);
    case 'statusQuoIntegrity':
      return clamp(v, 0, 100);
    case 'budget':
      return Math.max(0, v);
    case 'threatPerception':
    case 'perceivedResolve':
    case 'perceivedCapability':
    case 'internalPressure':
      return clamp01(v);
    case 'armingLevel':
      return clamp(v, 0, 10);
    default:
      return v;
  }
}

function getStock(state: GameState, target: string): number {
  switch (target) {
    case 'budget':
      return state.player.budget;
    case 'politicalCapital':
      return state.player.politicalCapital;
    case 'statusQuoIntegrity':
      return state.world.statusQuoIntegrity;
    case 'threatPerception':
      return state.rival.threatPerception;
    case 'internalPressure':
      return state.rival.internalPressure;
    case 'perceivedResolve':
      return state.rival.perceivedResolve;
    case 'perceivedCapability':
      return state.rival.perceivedCapability;
    case 'armingLevel':
      return state.rival.armingLevel;
    default:
      return 0;
  }
}

function setStock(state: GameState, target: string, v: number, pcCap: number): void {
  const c = clampTarget(target, v, pcCap);
  switch (target) {
    case 'budget':
      state.player.budget = c;
      break;
    case 'politicalCapital':
      state.player.politicalCapital = c;
      break;
    case 'statusQuoIntegrity':
      state.world.statusQuoIntegrity = c;
      break;
    case 'threatPerception':
      state.rival.threatPerception = c;
      break;
    case 'internalPressure':
      state.rival.internalPressure = c;
      break;
    case 'perceivedResolve':
      state.rival.perceivedResolve = c;
      break;
    case 'perceivedCapability':
      state.rival.perceivedCapability = c;
      break;
    case 'armingLevel':
      state.rival.armingLevel = c;
      break;
  }
}

// Apply one effect. `sourceId` + `turn` used for duration registration; `pcCap`
// is the scenario's political-capital ceiling (every PC pathway respects it).
export function applyEffect(
  state: GameState,
  effect: EffectSpec,
  sourceId: string,
  turn: number,
  pcCap: number,
): void {
  const { target, op, value, durationTurns } = effect;
  // Stocks mutate immediately. `durationTurns` is meaningless on a stock (no
  // consumer applies modifiers to stocks) and content validation rejects it,
  // but apply the stock anyway so a stray duration can never silently no-op.
  if (STOCK_TARGETS.has(target)) {
    setStock(state, target, applyOp(getStock(state, target), op, value), pcCap);
    return;
  }
  if (FLOW_TARGETS.has(target)) {
    // Duration semantics: a modifier is active while `expiresOnTurn > turn`, so
    // `durationTurns: N` applied on turn T covers turns T..T+N-1. Effects that
    // shape the *next* quarter's generation (e.g. intel collection, produced at
    // end of turn) therefore need N=2 to yield one quarter of boost.
    const dur = durationTurns ?? 1;
    state.world.activeModifiers.push({
      // Unique per application so repeated firings don't collide on one id.
      id: `${sourceId}:${target}:${turn}`,
      target,
      op,
      value,
      expiresOnTurn: turn + dur,
    });
    return;
  }
  // Unknown targets are ignored defensively (validation forbids them in CI).
}

export function applyEffects(
  state: GameState,
  effects: EffectSpec[],
  sourceId: string,
  turn: number,
  pcCap: number,
): void {
  for (const e of effects) applyEffect(state, e, sourceId, turn, pcCap);
}

// Product of active `mul` modifiers on a flow target (default 1).
export function flowMultiplier(state: GameState, target: string, turn: number): number {
  let m = 1;
  for (const mod of state.world.activeModifiers) {
    if (mod.target === target && mod.op === 'mul' && mod.expiresOnTurn > turn) {
      m *= mod.value;
    }
  }
  return m;
}

// True if any active modifier sets a flag target truthy this turn.
export function flagActive(state: GameState, target: string, turn: number): boolean {
  for (const mod of state.world.activeModifiers) {
    if (mod.target === target && mod.expiresOnTurn > turn && mod.value !== 0) {
      return true;
    }
  }
  return false;
}

export function expireModifiers(state: GameState, turn: number): void {
  state.world.activeModifiers = state.world.activeModifiers.filter(
    (m) => m.expiresOnTurn > turn,
  );
}
