import { describe, expect, it } from 'vitest';
import { commitmentLedger, commitmentSummary } from '../src/engine/commitments';
import { createInitialState } from '../src/engine/setup';
import { resolveTurn } from '../src/engine/resolver';
import type { GameState, ResponseType, TurnDecisions } from '../src/engine/types';
import { pack } from './helpers';

const content = pack();

function playQuarter(
  state: GameState,
  opts: {
    probe?: ResponseType;
    purchases?: { cardId: string; rationaleId: string }[];
  },
): GameState {
  const d: TurnDecisions = { turn: state.meta.turnNumber, purchases: opts.purchases ?? [] };
  if (state.world.stagedProbeId && opts.probe) {
    d.probeResponse = {
      probeId: state.world.stagedProbeId,
      responseType: opts.probe,
      rationaleId: 'auto',
    };
  }
  return resolveTurn(state, d, content);
}

// Declare the red line (floor MATCH, scope: frontier), then advance until a
// frontier probe is staged and answer it with `response`.
function declareThenAnswer(response: ResponseType): GameState {
  let state = createInitialState(content, 2, 'TEST_CREATED_AT');
  state = playQuarter(state, {
    purchases: [{ cardId: 'sig_redline', rationaleId: 'auto' }],
  });
  for (let i = 0; i < 40; i += 1) {
    const staged = state.world.stagedProbeId
      ? content.probes.find((p) => p.id === state.world.stagedProbeId)
      : undefined;
    if (staged?.tags.includes('frontier')) return playQuarter(state, { probe: response });
    state = playQuarter(state, { probe: 'MATCH' });
  }
  throw new Error('no frontier probe was staged');
}

describe('commitment ledger', () => {
  it('reports a standing commitment as untested', () => {
    let state = createInitialState(content, 2, 'TEST_CREATED_AT');
    state = playQuarter(state, {
      purchases: [{ cardId: 'sig_redline', rationaleId: 'auto' }],
    });

    const [entry] = commitmentLedger(state, content);
    expect(entry.status).toBe('STANDING');
    expect(entry.floorResponse).toBe('MATCH');
    expect(entry.tests).toHaveLength(0);
    expect(commitmentSummary(entry)).toContain('No in-scope provocation');
  });

  it('does not count the probe answered in the quarter of declaration', () => {
    // sig_tripwire_treaty covers maritime, which the opening probe usually is;
    // the resolver creates commitments only after the probe is resolved.
    let state = createInitialState(content, 2, 'TEST_CREATED_AT');
    while (!state.world.stagedProbeId) state = playQuarter(state, {});
    const next = playQuarter(state, {
      probe: 'CONCEDE',
      purchases: [{ cardId: 'sig_tripwire_treaty', rationaleId: 'auto' }],
    });

    const [entry] = commitmentLedger(next, content);
    expect(next.world.probeLog.length).toBeGreaterThan(0);
    expect(entry.tests).toHaveLength(0);
    expect(entry.status).toBe('STANDING');
  });

  it('reports the political capital the verdict actually moved', () => {
    let state = createInitialState(content, 2, 'TEST_CREATED_AT');
    state = playQuarter(state, {
      purchases: [{ cardId: 'sig_redline', rationaleId: 'auto' }],
    });
    for (let i = 0; i < 40; i += 1) {
      const staged = state.world.stagedProbeId
        ? content.probes.find((p) => p.id === state.world.stagedProbeId)
        : undefined;
      if (staged?.tags.includes('frontier')) break;
      state = playQuarter(state, { probe: 'MATCH' });
    }
    const nominal = state.player.commitmentRegister[0].backDownPenaltyPC;
    const full = playQuarter(state, { probe: 'CONCEDE' });
    expect(commitmentLedger(full, content)[0].tests.at(-1)?.pcDelta).toBe(-nominal);

    // Political capital floors at 0, so a break with almost none left costs
    // less than the nominal penalty — the ledger reports what was applied.
    const broke = { ...state, player: { ...state.player, politicalCapital: 1 } };
    const clamped = playQuarter(broke, { probe: 'CONCEDE' });
    const test = commitmentLedger(clamped, content)[0].tests.at(-1);
    expect(test?.pcDelta).toBe(-1);
    expect(Math.abs(test?.pcDelta ?? 0)).toBeLessThan(nominal);
  });

  it('records a test that met the floor as honored, with the PC reward', () => {
    const state = declareThenAnswer('ENFORCE');
    const [entry] = commitmentLedger(state, content);
    const test = entry.tests.at(-1);

    expect(entry.status).toBe('HONORED');
    expect(test?.honored).toBe(true);
    expect(test?.responseType).toBe('ENFORCE');
    expect(test?.pcDelta).toBeGreaterThan(0);
    expect(test?.pcDelta).toBeLessThanOrEqual(content.scenario.tuning.honoredTestPC);
    expect(commitmentSummary(entry)).toContain('kept');
  });

  it('records a test below the floor as broken, and stops testing afterwards', () => {
    const state = declareThenAnswer('PROTEST');
    const [entry] = commitmentLedger(state, content);
    const test = entry.tests.at(-1);

    expect(entry.status).toBe('BROKEN');
    expect(test?.honored).toBe(false);
    expect(test?.pcDelta).toBeLessThan(0);
    // A broken commitment is never tested again, so the break is the last row.
    expect(entry.tests.filter((t) => !t.honored)).toHaveLength(1);
    expect(commitmentSummary(entry)).toContain('broke it');
  });

  it('ignores probes outside the commitment scope', () => {
    const state = declareThenAnswer('ENFORCE');
    const [entry] = commitmentLedger(state, content);

    for (const t of entry.tests) {
      const probe = content.probes.find((p) => p.id === t.probeId);
      expect(probe?.tags.some((tag) => entry.scopeProbeTags.includes(tag))).toBe(true);
    }
    expect(entry.tests.length).toBeLessThanOrEqual(state.world.probeLog.length);
  });
});
