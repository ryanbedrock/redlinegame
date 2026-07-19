// ============================================================================
// Rival engine (PRD §6.5 phases 5–7, §6.6). The Rival is AUTHORED, not
// simulated: three content-defined rule tables (one per type) sharing one
// schema, evaluated deterministically via the condition DSL. Pure module.
// ============================================================================

import type { ContentPack, GameState } from './types';
import { buildRivalVars } from './context';
import { evalBool } from './conditions';
import { rollInt } from './rng';
import {
  clamp,
  clamp01,
  costEstimate,
  gainForType,
  pSuccess,
  warUtility,
} from './formulas';

// Phase 5: advance Rival internal state (internalPressure, armingLevel).
export function advanceRivalInternal(state: GameState, content: ContentPack): void {
  const def = content.rivalTypes[state.rival.type];
  const r = state.rival;

  // Internal pressure follows the authored per-type schedule (± event mods
  // already folded into internalPressure via effects during phase 8/prev turn).
  r.internalPressure = clamp01(r.internalPressure + def.pressureSchedulePerTurn);

  // Arming: SECURITY_SEEKER arms as a function of threatPerception; others
  // drift toward a scheduled target.
  let target: number;
  if (r.type === 'SECURITY_SEEKER') {
    target = clamp(def.armingFromThreat * r.threatPerception * 10, 0, 10);
  } else {
    target = clamp(def.baseArmingSchedule, 0, 10);
  }
  // Move a fraction toward target each turn (smooth, bounded) so the player
  // has time to build denial before the capability gap opens.
  const step = 0.25;
  r.armingLevel = clamp(r.armingLevel + (target - r.armingLevel) * step, 0, 10);
}

export interface DecisionResult {
  pSuccess: number;
  gain: number;
  costEstimate: number;
  warUtility: number;
  warThreshold: number;
  warTriggered: boolean;
}

// Phase 6: evaluate the Rival decision function. One feasibility-scaled family
// with per-type coefficients (§6.5-6). Sets ending = WAR if warUtility ≥
// threshold for `warThresholdConsecutiveTurns` consecutive turns.
export function evaluateDecision(state: GameState, content: ContentPack): DecisionResult {
  const def = content.rivalTypes[state.rival.type];
  const r = state.rival;
  const ps = pSuccess(r.armingLevel, state.player.tracks.denial);
  const cost = costEstimate(state.player.tracks.punishment);
  const gain = gainForType(def, r.internalPressure, r.threatPerception);
  const wu = warUtility(def, ps, gain, cost, r.perceivedResolve);

  r.warUtility = wu;
  if (wu >= def.warThreshold) {
    r.warUtilityStreak += 1;
  } else {
    r.warUtilityStreak = 0;
  }

  const needed = content.scenario.tuning.warThresholdConsecutiveTurns;
  const warTriggered = r.warUtilityStreak >= needed;
  if (warTriggered) {
    state.meta.ending = 'WAR';
  }

  return {
    pSuccess: ps,
    gain,
    costEstimate: cost,
    warUtility: wu,
    warThreshold: def.warThreshold,
    warTriggered,
  };
}

// Phase 7: probe generation. Evaluate the per-type PROBE rule table against
// RIVAL_CONTEXT; the highest-priority satisfied rule off cooldown wins. Salami
// escalation (concessionStreak ≥ threshold → severity +1, salamiValue ×1.5) is
// applied when the probe is staged; stored on the staged probe via world state.
export function generateProbe(state: GameState, content: ContentPack): void {
  const r = state.rival;

  // Decrement cooldowns.
  for (const id of Object.keys(r.probeCooldowns)) {
    if (r.probeCooldowns[id] > 0) r.probeCooldowns[id] -= 1;
  }

  const vars = buildRivalVars(state, content);
  const rules = content.rivalRules
    .filter((rule) => rule.type === r.type && rule.kind === 'PROBE')
    .slice()
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  let chosen: string | null = null;
  for (const rule of rules) {
    if (!rule.probeId) continue;
    if ((r.probeCooldowns[rule.probeId] ?? 0) > 0) continue;
    if (evalBool(rule.condition, vars)) {
      chosen = rule.probeId;
      const cd = rule.cooldownTurns ?? 0;
      if (cd > 0) r.probeCooldowns[rule.probeId] = cd;
      break;
    }
  }

  state.world.stagedProbeId = chosen;

  // Controlled randomness (the `probes` stream): pick a flavor variant at random
  // so a repeated probe reads differently across appearances (same mechanics,
  // new text). A single-draw dedupe against the last-shown variant avoids the
  // jarring case of the exact same text twice in a row when the pool allows it.
  if (chosen) {
    const probe = content.probes.find((p) => p.id === chosen);
    const pool = probe?.variants?.length ?? 0;
    if (pool > 0) {
      const last = state.world.probeLog
        .filter((p) => p.probeId === chosen)
        .slice(-1)[0]?.variant;
      let pick = rollInt(state.meta.seed, state.rng, 'probes', 0, pool - 1);
      if (pool > 1 && pick === last) {
        pick = (pick + 1 + rollInt(state.meta.seed, state.rng, 'probes', 0, pool - 2)) % pool;
      }
      state.world.stagedProbeVariant = pick;
    } else {
      state.world.stagedProbeVariant = 0;
    }
  } else {
    state.world.stagedProbeVariant = 0;
  }
}
