import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/setup';
import { resolveTurn } from '../src/engine/resolver';
import { hashState } from '../src/engine/analytics';
import { pack } from './helpers';
import type { TurnDecisions } from '../src/engine/types';

// AC-2: the resolver is a pure function of (state, decisions, content).
describe('AC-2 resolver purity', () => {
  const content = pack();

  it('does not mutate the input state', () => {
    const state = createInitialState(content, 1, 'CREATED');
    const before = hashState(state);
    const decisions: TurnDecisions = {
      turn: state.meta.turnNumber,
      purchases: [{ cardId: 'inv_denial_1', rationaleId: 'auto' }],
      probeResponse: state.world.stagedProbeId
        ? { probeId: state.world.stagedProbeId, responseType: 'MATCH', rationaleId: 'auto' }
        : undefined,
    };
    resolveTurn(state, decisions, content);
    expect(hashState(state)).toBe(before);
  });

  it('is referentially transparent (same inputs ⇒ same output)', () => {
    const state = createInitialState(content, 7, 'CREATED');
    const decisions: TurnDecisions = { turn: state.meta.turnNumber, purchases: [] };
    const out1 = resolveTurn(state, decisions, content);
    const out2 = resolveTurn(state, decisions, content);
    expect(hashState(out1)).toBe(hashState(out2));
  });

  it('content pack is deeply frozen', () => {
    expect(Object.isFrozen(content)).toBe(true);
    expect(Object.isFrozen(content.scenario)).toBe(true);
    expect(Object.isFrozen(content.rivalTypes)).toBe(true);
  });
});
