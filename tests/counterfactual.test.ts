import { describe, expect, it } from 'vitest';
import { runCounterfactualReport } from '../src/engine/counterfactual';
import { pack, playScripted, rushDenial } from './helpers';

// AC-9 / AC-11 / AC-12: the counterfactual debrief re-simulates the identity
// replay exactly, sweeps policies + sub-seeded pivots + rival-type swaps.
describe('AC-9/AC-11/AC-12 counterfactual report', () => {
  const content = pack();

  it('identity replay reproduces the live campaign ending exactly', () => {
    const live = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const report = runCounterfactualReport(content, 2, live.decisions, live.state.rival.type);
    expect(report.actual.finalState.meta.ending).toBe(live.state.meta.ending);
  });

  it('re-simulation count matches identity + policies + pivots×sub-seeds + type swaps', () => {
    const live = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const report = runCounterfactualReport(content, 2, live.decisions, live.state.rival.type);
    const expected =
      1 +
      report.policies.length +
      report.pivots.length * content.scenario.tuning.pivotSubSeeds +
      report.typeSwaps.length;
    expect(report.reSimCount).toBe(expected);
    expect(report.pivots.length).toBeLessThanOrEqual(content.scenario.tuning.maxPivots);
  });

  it('swaps in the two other hidden types and reports bounded robustness', () => {
    const live = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const report = runCounterfactualReport(content, 2, live.decisions, live.state.rival.type);
    expect(report.typeSwaps.length).toBe(2);
    for (const ts of report.typeSwaps) expect(ts.type).not.toBe(live.state.rival.type);
    expect(report.robustness01).toBeGreaterThanOrEqual(0);
    expect(report.robustness01).toBeLessThanOrEqual(1);
  });

  it('produces a per-turn lattice for the actual run', () => {
    const live = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const report = runCounterfactualReport(content, 2, live.decisions, live.state.rival.type);
    expect(report.actual.lattice.length).toBeGreaterThan(0);
  });
});
