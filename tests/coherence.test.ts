import { describe, expect, it } from 'vitest';
import { coherenceAudit } from '../src/engine/coherence';
import { computeScore, credibilityScore } from '../src/engine/analytics';
import { createInitialState } from '../src/engine/setup';
import { resolveTurn } from '../src/engine/resolver';
import type { GameState, ResponseType, TurnDecisions } from '../src/engine/types';
import { pack } from './helpers';

const content = pack();

// Play a single quarter, answering any staged probe with the given rationale.
function playQuarter(
  state: GameState,
  opts: {
    probe?: { responseType: ResponseType; rationaleId: string };
    purchases?: { cardId: string; rationaleId: string }[];
  },
): GameState {
  const d: TurnDecisions = { turn: state.meta.turnNumber, purchases: opts.purchases ?? [] };
  if (state.world.stagedProbeId && opts.probe) {
    d.probeResponse = { probeId: state.world.stagedProbeId, ...opts.probe };
  }
  return resolveTurn(state, d, content);
}

describe('rationale coherence audit', () => {
  it('flags a probe response that contradicts its stated reason', () => {
    let state = createInitialState(content, 2, 'TEST_CREATED_AT');
    while (!state.world.stagedProbeId) state = playQuarter(state, {});
    const conceded = playQuarter(state, {
      probe: { responseType: 'CONCEDE', rationaleId: 'firmness' },
    });
    const matched = playQuarter(state, {
      probe: { responseType: 'MATCH', rationaleId: 'firmness' },
    });

    const bad = coherenceAudit(conceded, content).rows.filter((r) => r.kind === 'PROBE_RESPONSE');
    const good = coherenceAudit(matched, content).rows.filter((r) => r.kind === 'PROBE_RESPONSE');
    expect(bad.at(-1)?.verdict).toBe('MISMATCH');
    expect(good.at(-1)?.verdict).toBe('CONSISTENT');
  });

  it('treats deterrence by cheap talk as incoherent but a costly signal as coherent', () => {
    const state = createInitialState(content, 2, 'TEST_CREATED_AT');
    const cheap = playQuarter(state, {
      purchases: [{ cardId: 'sig_statement', rationaleId: 'deter' }],
    });
    const costly = playQuarter(state, {
      purchases: [{ cardId: 'sig_exercise', rationaleId: 'deter' }],
    });

    expect(coherenceAudit(cheap, content).mismatches).toBe(1);
    expect(coherenceAudit(costly, content).mismatches).toBe(0);
  });

  it('leaves unjustified decisions unscored', () => {
    const state = createInitialState(content, 2, 'TEST_CREATED_AT');
    const next = playQuarter(state, {
      purchases: [{ cardId: 'sig_statement', rationaleId: 'auto' }],
    });
    const audit = coherenceAudit(next, content);
    expect(audit.rows.every((r) => r.verdict === 'UNSCORED')).toBe(true);
    expect(audit.scored).toBe(0);
  });

  it('drags the credibility term below commitment discipline alone', () => {
    let state = createInitialState(content, 2, 'TEST_CREATED_AT');
    while (!state.world.stagedProbeId) state = playQuarter(state, {});
    state = playQuarter(state, {
      probe: { responseType: 'CONCEDE', rationaleId: 'firmness' },
      purchases: [{ cardId: 'sig_statement', rationaleId: 'deter' }],
    });

    const score = computeScore(state, content, 1);
    expect(score.coherence).toBe(0);
    expect(score.discipline).toBeCloseTo(credibilityScore(state) * 100, 6);
    expect(score.credibility).toBeLessThan(score.discipline);
  });
});
