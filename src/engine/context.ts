// ============================================================================
// Build DSL variable bags from GameState for the two evaluation contexts
// (Annex A.2). RIVAL_CONTEXT exposes hidden ledgers (used only by the engine,
// never surfaced to the UI); PLAYER_CONTEXT exposes visible state only.
// Pure module (AC-2).
// ============================================================================

import type { GameState, ContentPack, TypeBeliefRecord } from './types';
import type { VarBag } from './conditions';
import { effectiveBackDowns } from './formulas';

function latestBelief(beliefs: TypeBeliefRecord[]): string {
  if (beliefs.length === 0) return 'UNSURE';
  return beliefs[beliefs.length - 1].statedType;
}

export function buildRivalVars(state: GameState, content: ContentPack): VarBag {
  const p = state.player;
  const r = state.rival;
  const w = state.world;
  return {
    turn: state.meta.turnNumber,
    turnCount: content.scenario.turnCount,
    statusQuoIntegrity: w.statusQuoIntegrity,
    perceivedResolve: r.perceivedResolve,
    perceivedCapability: r.perceivedCapability,
    threatPerception: r.threatPerception,
    internalPressure: r.internalPressure,
    warUtility: r.warUtility,
    armingLevel: r.armingLevel,
    concessionStreak: w.concessionStreak,
    backDownCount: p.backDownCount,
    effectiveBackDowns: effectiveBackDowns(p.backDownCount, p.honoredTestCount),
    honoredTestCount: p.honoredTestCount,
    playerDistractionActive: w.playerDistractionActive,
    'tracks.denial': p.tracks.denial,
    'tracks.punishment': p.tracks.punishment,
    'tracks.intelligence': p.tracks.intelligence,
    'tracks.readiness': p.tracks.readiness,
    politicalCapital: p.politicalCapital,
    budget: p.budget,
  };
}

export function buildPlayerVars(state: GameState, content: ContentPack): VarBag {
  const p = state.player;
  const w = state.world;
  return {
    turn: state.meta.turnNumber,
    turnCount: content.scenario.turnCount,
    statusQuoIntegrity: w.statusQuoIntegrity,
    politicalCapital: p.politicalCapital,
    budget: p.budget,
    backDownCount: p.backDownCount,
    honoredTestCount: p.honoredTestCount,
    statedTypeBelief: latestBelief(state.analytics.typeBeliefs),
    playerDistractionActive: w.playerDistractionActive,
    'tracks.denial': p.tracks.denial,
    'tracks.punishment': p.tracks.punishment,
    'tracks.intelligence': p.tracks.intelligence,
    'tracks.readiness': p.tracks.readiness,
  };
}
