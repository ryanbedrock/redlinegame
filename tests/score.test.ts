import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/engine/analytics';
import { pack, playScripted, rushDenial } from './helpers';

// The composite must share the 0-100 scale of its sub-scores.
describe('composite score scale', () => {
  const content = pack();

  it('reports the composite on the same 0-100 scale as the sub-scores', () => {
    const { state } = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const score = computeScore(state, content, 1);
    expect(score.outcome).toBe(100);
    expect(score.composite).toBeGreaterThan(1);
    expect(score.composite).toBeLessThanOrEqual(100);
  });

  it('is the weighted mean of the sub-scores', () => {
    const { state } = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const w = content.scenario.scoring.weights;
    const score = computeScore(state, content, 0.5);
    const expected =
      w.outcome * score.outcome +
      w.robustness * score.robustness +
      w.diagnosis * score.diagnosis +
      w.credibility * score.credibility +
      w.efficiency * score.efficiency;
    expect(score.composite).toBeCloseTo(expected, 6);
  });
});
