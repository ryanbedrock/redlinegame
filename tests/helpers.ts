// Shared test helpers: load a content pack and drive scripted games.

import { loadContentPack } from '../src/content-loader';
import { createInitialState } from '../src/engine/setup';
import { resolveTurn, resolveEpilogueTurn } from '../src/engine/resolver';
import type { ContentPack, GameState, ResponseType, TurnDecisions } from '../src/engine/types';

export function pack(id = 'scenario-1'): ContentPack {
  return loadContentPack(id);
}

export interface PlayConfig {
  probe?: ResponseType;
  // cards to attempt each turn (affordable ones applied by the resolver).
  buys?: (state: GameState) => string[];
  maxTurns?: number;
}

// Drive a full game (through any war epilogue) with a fixed strategy.
export function playScripted(
  content: ContentPack,
  seed: number,
  cfg: PlayConfig = {},
): { state: GameState; decisions: TurnDecisions[] } {
  let state = createInitialState(content, seed, 'TEST_CREATED_AT');
  const decisions: TurnDecisions[] = [];
  const cap = cfg.maxTurns ?? content.scenario.turnCount + 12;
  let guard = 0;
  while (state.meta.phase !== 'DEBRIEF' && guard < cap) {
    guard++;
    if (state.meta.phase === 'EPILOGUE') {
      const eTurn = state.meta.epilogueTurn ?? 1;
      const decision = content.epilogue.decisions[eTurn - 1];
      state = resolveEpilogueTurn(
        state,
        {
          turn: state.meta.turnNumber,
          purchases: [],
          epilogueChoice: decision ? { decisionId: decision.id, optionId: decision.options[0].id } : undefined,
        },
        content,
      );
      continue;
    }
    const d: TurnDecisions = { turn: state.meta.turnNumber, purchases: [] };
    if (cfg.buys) {
      for (const cardId of cfg.buys(state)) d.purchases.push({ cardId, rationaleId: 'auto' });
    }
    if (state.world.stagedProbeId && cfg.probe) {
      d.probeResponse = { probeId: state.world.stagedProbeId, responseType: cfg.probe, rationaleId: 'auto' };
    }
    decisions.push(d);
    state = resolveTurn(state, d, content);
  }
  return { state, decisions };
}

export function rushDenial(state: GameState): string[] {
  if (state.player.tracks.denial < 3 && !state.player.pendingInvestments.some((p) => p.trackOrSignalId === 'inv_denial_1')) {
    return ['inv_denial_1'];
  }
  if (state.player.tracks.denial >= 3) return ['inv_denial_2'];
  return [];
}
