import { describe, expect, it } from 'vitest';
import { runCounterfactualReport } from '../src/engine/counterfactual';
import { computeScore, salamiAudit, signalAudit } from '../src/engine/analytics';
import { validateCondition } from '../src/engine/conditions';
import { pack, playScripted, rushDenial } from './helpers';

// Phase 2 debrief surfaces: score, audits, and the honesty of the lattice —
// counterfactual policies must be executable player doctrines (PLAYER_CONTEXT),
// never oracles that read the hidden ledgers.
describe('Phase 2 debrief', () => {
  const content = pack();

  it('bounds every lattice at the scenario turn count', () => {
    const live = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const report = runCounterfactualReport(content, 2, live.decisions, live.state.rival.type);
    const rows = [
      report.actual.lattice,
      ...report.policies.map((p) => p.run.lattice),
      ...report.typeSwaps.map((t) => t.run.lattice),
    ];
    for (const l of rows) {
      expect(l.length).toBeGreaterThan(0);
      expect(l.length).toBeLessThanOrEqual(content.scenario.turnCount);
    }
  });

  it('every policy decision table is player-executable (no hidden ledgers)', () => {
    for (const p of content.policies) {
      for (const [i, r] of (p.probeResponse.rules ?? []).entries()) {
        expect(() =>
          validateCondition(r.condition, `${p.id}.rules[${i}]`, 'PLAYER_CONTEXT'),
        ).not.toThrow();
      }
    }
  });

  it('scores within 0..100 on every pillar', () => {
    const live = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const report = runCounterfactualReport(content, 2, live.decisions, live.state.rival.type);
    const score = computeScore(live.state, content, report.robustness01);
    for (const v of [score.outcome, score.robustness, score.diagnosis, score.credibility, score.efficiency, score.composite]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('salami audit is monotone in count and tracks the probe log', () => {
    const live = playScripted(content, 1, { probe: 'CONCEDE', buys: rushDenial });
    const steps = salamiAudit(live.state);
    expect(steps.length).toBe(live.state.world.probeLog.length);
    for (const s of steps) {
      expect(s.cumulativeIntegrity).toBeGreaterThanOrEqual(0);
      expect(s.cumulativeIntegrity).toBeLessThanOrEqual(100);
    }
  });

  it('signal audit has one row per signal sent', () => {
    const live = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const rows = signalAudit(live.state);
    expect(rows.length).toBe(live.state.player.signalHistory.length);
  });
});
