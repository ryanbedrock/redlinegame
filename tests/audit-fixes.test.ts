import { describe, expect, it } from 'vitest';
import { beliefTrajectory, credibilityScore } from '../src/engine/analytics';
import { intelConfidence, intelSigma, terminationBonus } from '../src/engine/formulas';
import { resolveTurn } from '../src/engine/resolver';
import { createInitialState } from '../src/engine/setup';
import type { ContentPack, GameState, TurnDecisions } from '../src/engine/types';
import { pack, playScripted } from './helpers';

function matchTurn(state: GameState): TurnDecisions {
  const d: TurnDecisions = { turn: state.meta.turnNumber, purchases: [] };
  if (state.world.stagedProbeId) {
    d.probeResponse = { probeId: state.world.stagedProbeId, responseType: 'MATCH', rationaleId: 'auto' };
  }
  return d;
}

describe('termination leverage bonus', () => {
  const f = pack().epilogue.outcomeFormula;
  it('pays per level above 3, capped', () => {
    expect(terminationBonus(2, f)).toBe(0);
    expect(terminationBonus(6, f)).toBe(12);
    expect(terminationBonus(10, f)).toBe(20);
  });
});

describe('credibility discipline', () => {
  const content = pack();
  it('keeps the no-evidence baseline for a commitment that was never tested', () => {
    const state = createInitialState(content, 1, 'TEST_CREATED_AT');
    expect(credibilityScore(state)).toBeCloseTo(0.6, 9);
    state.player.commitmentRegister.push({
      id: 'sig_redline@0',
      cardId: 'sig_redline',
      declaredOnTurn: 0,
      scopeProbeTags: ['frontier'],
      floorResponse: 'MATCH',
      backDownPenaltyPC: 4,
      upkeepPC: 1,
      timesTested: 0,
      timesHonored: 0,
      status: 'STANDING',
    });
    expect(credibilityScore(state)).toBeCloseTo(0.6, 9);
  });
});

describe('diagnosis trajectory', () => {
  const content = pack();
  it('does not count resolving UNSURE into a type as a flip-flop', () => {
    const state = createInitialState(content, 1, 'TEST_CREATED_AT');
    const t = state.rival.type;
    state.analytics.typeBeliefs = [
      { turn: 0, statedType: 'UNSURE' },
      { turn: 1, statedType: t },
    ];
    expect(beliefTrajectory(state, t).flipFlops).toBe(0);
  });

  it('counts a change of committed type across an UNSURE gap', () => {
    const state = createInitialState(content, 1, 'TEST_CREATED_AT');
    state.analytics.typeBeliefs = [
      { turn: 0, statedType: 'OPPORTUNIST' },
      { turn: 1, statedType: 'UNSURE' },
      { turn: 2, statedType: 'SECURITY_SEEKER' },
    ];
    expect(beliefTrajectory(state, 'SECURITY_SEEKER').flipFlops).toBe(1);
  });

  it('judges the final assessment when nothing was spent', () => {
    const state = createInitialState(content, 1, 'TEST_CREATED_AT');
    const t = state.rival.type;
    state.analytics.typeBeliefs = [{ turn: 0, statedType: t }];
    const traj = beliefTrajectory(state, t);
    expect(traj.beliefAtLockIn).toBe(t);
    expect(traj.score).toBeGreaterThanOrEqual(0.6);
  });
});

describe('intel confidence', () => {
  const { intelSigmaLevel0: s0, intelSigmaLevel10: s10 } = pack().scenario.tuning;
  it('reaches HIGH at the top authored intelligence level', () => {
    expect(intelConfidence(intelSigma(1, s0, s10))).toBe('LOW');
    expect(intelConfidence(intelSigma(3, s0, s10))).toBe('MODERATE');
    expect(intelConfidence(intelSigma(6, s0, s10))).toBe('HIGH');
  });
});

describe('deception bias', () => {
  const content = pack();
  it('biases exactly biasDurationTurns subsequent readings', () => {
    let clean = createInitialState(content, 1337, 'TEST_CREATED_AT');
    let biased = structuredClone(clean);
    biased.world.biasActive = { metric: 'INTENT_ASSESSMENT', amount: 0.15, expiresOnTurn: 0 + 3 };
    for (let i = 0; i < 4; i++) {
      clean = resolveTurn(clean, matchTurn(clean), content);
      biased = resolveTurn(biased, matchTurn(biased), content);
    }
    const intent = (s: GameState, turn: number) =>
      s.world.intel.find((e) => e.turn === turn && e.metric === 'INTENT_ASSESSMENT')!.value;
    for (const turn of [1, 2, 3]) expect(intent(biased, turn)).toBeGreaterThan(intent(clean, turn));
    expect(intent(biased, 4)).toBe(intent(clean, 4));
  });
});

describe('scenario beats', () => {
  it('re-time an event to the scenario window', () => {
    const content = structuredClone(pack()) as ContentPack;
    const beat = content.scenario.beats.find((b) => b.eventId === 'evt_budget_windfall')!;
    beat.minTurn = 5;
    beat.maxTurn = 5;
    const { state } = playScripted(content, 1337, { probe: 'MATCH' });
    expect(state.world.eventLog.find((e) => e.eventId === 'evt_budget_windfall')?.turn).toBe(5);
  });
});
