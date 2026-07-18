// ============================================================================
// EffectSpec application (Annex A.1). Events and inbox responses carry typed
// effects. "Stock" targets mutate immediately; "flow"/flag targets with a
// duration register ActiveModifiers queried by the resolver. Pure module.
// ============================================================================

import type { EffectSpec, GameState } from './types';
import { clamp, clamp01 } from './formulas';

// Immediate scalar stocks (one-time mutation).
const STOCK_TARGETS = new Set<string>([
  'budget',
  'politicalCapital',
  'statusQuoIntegrity',
  'rival.threatPerception',
  'rival.internalPressure',
  'rival.perceivedResolve',
  'rival.perceivedCapability',
  'rival.armingLevel',
]);

// Duration-based flow/flag targets (registered as ActiveModifiers).
const FLOW_TARGETS = new Set<string>([
  'budgetIncome',
  'playerDistractionActive',
  'audienceCostMultiplier',
]);

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

function clampTarget(target: string, v: number): number {
  switch (target) {
    case 'politicalCapital':
      return clamp(v, 0, 100);
    case 'statusQuoIntegrity':
      return clamp(v, 0, 100);
    case 'budget':
      return Math.max(0, v);
    case 'rival.threatPerception':
    case 'rival.perceivedResolve':
    case 'rival.perceivedCapability':
    case 'rival.internalPressure':
      return clamp01(v);
    case 'rival.armingLevel':
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
    case 'rival.threatPerception':
      return state.rival.threatPerception;
    case 'rival.internalPressure':
      return state.rival.internalPressure;
    case 'rival.perceivedResolve':
      return state.rival.perceivedResolve;
    case 'rival.perceivedCapability':
      return state.rival.perceivedCapability;
    case 'rival.armingLevel':
      return state.rival.armingLevel;
    default:
      return 0;
  }
}

function setStock(state: GameState, target: string, v: number): void {
  const c = clampTarget(target, v);
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
    case 'rival.threatPerception':
      state.rival.threatPerception = c;
      break;
    case 'rival.internalPressure':
      state.rival.internalPressure = c;
      break;
    case 'rival.perceivedResolve':
      state.rival.perceivedResolve = c;
      break;
    case 'rival.perceivedCapability':
      state.rival.perceivedCapability = c;
      break;
    case 'rival.armingLevel':
      state.rival.armingLevel = c;
      break;
  }
}

// Apply one effect. `sourceId` + `turn` used for duration registration.
export function applyEffect(
  state: GameState,
  effect: EffectSpec,
  sourceId: string,
  turn: number,
): void {
  const { target, op, value, durationTurns } = effect;
  if (STOCK_TARGETS.has(target) && !durationTurns) {
    setStock(state, target, applyOp(getStock(state, target), op, value));
    return;
  }
  if (FLOW_TARGETS.has(target) || durationTurns) {
    const dur = durationTurns ?? 1;
    state.world.activeModifiers.push({
      id: `${sourceId}:${target}`,
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
): void {
  for (const e of effects) applyEffect(state, e, sourceId, turn);
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
