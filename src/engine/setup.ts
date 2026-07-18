// ============================================================================
// Initial GameState construction (PRD §6.2, §6.4). Pure: createdAt is passed
// in by the caller (the store), never read from the clock, so the engine stays
// referentially transparent (AC-2).
// ============================================================================

import type { ContentPack, GameState, RivalType } from './types';
import { RIVAL_TYPES, RNG_STREAMS } from './types';
import { hash32 } from './rng';
import { primeInitialTurn } from './resolver';

// Derive the hidden Rival type deterministically from (scenarioId, seed),
// unless the scenario pins a seed→type mapping.
export function typeFromSeed(content: ContentPack, seed: number): RivalType {
  const pin = content.scenario.seedTypePins?.find((p) => p.seed === seed);
  if (pin) return pin.type;
  const h = hash32(content.scenario.id, seed);
  return RIVAL_TYPES[h % 3];
}

export function createInitialState(
  content: ContentPack,
  seed: number,
  createdAt: string,
  displayName?: string,
  typeOverride?: RivalType,
): GameState {
  const sc = content.scenario;
  const type = typeOverride ?? typeFromSeed(content, seed);
  const def = content.rivalTypes[type];

  const streamCursors = {} as GameState['rng']['streamCursors'];
  for (const s of RNG_STREAMS) streamCursors[s] = 0;

  const state: GameState = {
    meta: {
      schemaVersion: '1.1.0',
      scenarioId: sc.id,
      seed,
      createdAt,
      turnNumber: 0,
      phase: 'SITREP',
      ending: null,
      displayName,
    },
    rng: { streamCursors },
    player: {
      budget: sc.opening.budget,
      budgetIncome: sc.tuning.budgetIncome,
      politicalCapital: sc.opening.politicalCapital,
      tracks: { ...sc.opening.tracks },
      pendingInvestments: [],
      commitmentRegister: [],
      backDownCount: 0,
      honoredTestCount: 0,
      signalHistory: [],
      purchaseCounts: {},
      lastPurchaseTurn: {},
    },
    rival: {
      type,
      perceivedCapability: def.priorCapability,
      perceivedResolve: def.priorResolve,
      threatPerception: def.priorThreatPerception,
      internalPressure: 0,
      warUtility: 0,
      warUtilityStreak: 0,
      probeCooldowns: {},
      armingLevel: sc.opening.priorArmingLevel,
    },
    world: {
      statusQuoIntegrity: sc.opening.statusQuoIntegrity,
      concessionStreak: 0,
      probeLog: [],
      intel: [],
      inbox: [],
      eventLog: [],
      activeModifiers: [],
      stagedProbeId: null,
      biasActive: null,
      playerDistractionActive: false,
    },
    epilogue: null,
    analytics: {
      decisions: [],
      typeBeliefs: [],
      perceptionHistory: [],
      turnRecords: [],
      cumulativeSpend: 0,
      lockInTurn: null,
    },
  };

  primeInitialTurn(state, content);
  return state;
}
