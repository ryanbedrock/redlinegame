// ============================================================================
// Pure numeric formulas for the resolver and Rival engine (PRD §6.5-6, §6.10).
// No randomness, no I/O.
// ============================================================================

import type {
  ResponseType,
  RivalTypeDef,
  SignalClass,
} from './types';
import { RESPONSE_ORDINAL } from './types';

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

// Logistic used for pSuccess = f(armingLevel - denialLevel). Centered at 0,
// slope tuned so a ±5-level gap saturates. Range (0,1).
export function logistic(x: number, slope = 0.45): number {
  return 1 / (1 + Math.exp(-slope * x));
}

// pSuccess: the Rival's estimated probability a seizure succeeds. Driven solely
// by the observable capability gap — its arming level vs the player's denial
// level. (Readiness affects investment lead-time elsewhere, not this formula.)
export function pSuccess(armingLevel: number, denialLevel: number): number {
  return clamp01(logistic(armingLevel - denialLevel));
}

// costEstimate: the punishment-capacity ceiling on expected post-seizure costs,
// normalized to a 0..1-ish scale. Credited resolve is NOT applied here — it
// scales this ceiling in `warUtility` (the `perceivedResolve` factor).
export function costEstimate(punishmentLevel: number): number {
  // Normalize punishment 0..10 → 0..1-ish cost scale.
  return punishmentLevel / 10;
}

// gain(type): the prize the Rival weighs, per §6.5-6.
export function gainForType(
  def: RivalTypeDef,
  internalPressure: number,
  threatPerception: number,
): number {
  switch (def.type) {
    case 'OPPORTUNIST':
      return def.prize;
    case 'PRESSURED_EXPANSIONIST':
      return def.prize + def.windowBonusScale * internalPressure;
    case 'SECURITY_SEEKER':
      return threatPerception * def.preemptionValue;
  }
}

// warUtility = pSuccess * gain - b * costEstimate * perceivedResolve.
export function warUtility(
  def: RivalTypeDef,
  ps: number,
  gain: number,
  cost: number,
  perceivedResolve: number,
): number {
  return ps * gain - def.b * cost * perceivedResolve;
}

// Tied-hands credibility multiplier (§6.5-4). Applies to TIED_HANDS only.
export function credibilityMultiplier(
  cls: SignalClass,
  effectiveBackDowns: number,
): number {
  if (cls !== 'TIED_HANDS') return 1;
  return Math.max(0.2, 1 - 0.25 * effectiveBackDowns);
}

// effectiveBackDowns = max(0, backDownCount - 0.5 * honoredTestCount) (§6.5-1).
export function effectiveBackDowns(
  backDownCount: number,
  honoredTestCount: number,
): number {
  return Math.max(0, backDownCount - 0.5 * honoredTestCount);
}

// Intel noise sigma interpolated by intelligence track level (§6.5 phase 9).
export function intelSigma(
  intelLevel: number,
  sigma0: number,
  sigma10: number,
): number {
  const t = clamp(intelLevel / 10, 0, 1);
  return sigma0 + (sigma10 - sigma0) * t;
}

// --- Probe ordinal-scale default effects (§6.3-D) ---------------------------

export interface ProbeEffect {
  statusQuoDelta: number;
  perceivedResolveDelta: number;
  threatPerceptionDelta: number;
  concessionStreakOp: 'inc' | 'reset';
}

export function probeDefaultEffects(
  responseType: ResponseType,
  salamiValue: number,
): ProbeEffect {
  switch (responseType) {
    case 'CONCEDE':
      return {
        statusQuoDelta: -salamiValue,
        perceivedResolveDelta: -0.08,
        threatPerceptionDelta: 0,
        concessionStreakOp: 'inc',
      };
    case 'PROTEST':
      return {
        statusQuoDelta: -0.75 * salamiValue,
        perceivedResolveDelta: -0.03,
        threatPerceptionDelta: 0,
        concessionStreakOp: 'inc',
      };
    case 'MATCH':
      return {
        statusQuoDelta: 0,
        perceivedResolveDelta: 0.02,
        threatPerceptionDelta: 0.01,
        concessionStreakOp: 'reset',
      };
    case 'ENFORCE':
      return {
        statusQuoDelta: 0.25 * salamiValue,
        perceivedResolveDelta: 0.05,
        threatPerceptionDelta: 0.03,
        concessionStreakOp: 'reset',
      };
    case 'ESCALATE':
      return {
        statusQuoDelta: 0.4 * salamiValue,
        perceivedResolveDelta: 0.08,
        threatPerceptionDelta: 0.06,
        concessionStreakOp: 'reset',
      };
  }
}

export function ordinal(r: ResponseType): number {
  return RESPONSE_ORDINAL[r];
}
