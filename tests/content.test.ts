import { describe, expect, it } from 'vitest';
import { assembleContentPack, listScenarios, loadContentPack, SCHEMAS, type RawFiles } from '../src/content-loader';

// AC-3: content is validated on load; malformed content is rejected.
describe('AC-3 content validation', () => {
  it('loads all three scenarios', () => {
    const ids = listScenarios().map((s) => s.id);
    expect(ids).toEqual(['scenario-1', 'scenario-2', 'scenario-3']);
    for (const id of ids) {
      const p = loadContentPack(id);
      expect(p.scenario.id).toBe(id);
      expect(p.scenario.turnCount).toBeGreaterThan(0);
      expect(Object.keys(p.rivalTypes).sort()).toEqual([
        'OPPORTUNIST',
        'PRESSURED_EXPANSIONIST',
        'SECURITY_SEEKER',
      ]);
    }
  });

  it('cardsById indexes every signal and investment', () => {
    const p = loadContentPack('scenario-1');
    for (const c of [...p.signals, ...p.investments]) {
      expect(p.cardsById[c.id]).toBe(c);
    }
  });

  it('rejects an unknown scenario id', () => {
    expect(() => loadContentPack('scenario-999')).toThrow();
  });

  it('rejects content whose rival rule references an unknown probe', () => {
    const base = loadContentPack('scenario-1');
    const badRules = structuredClone(base.rivalRules) as unknown[];
    (badRules[0] as { probeId: string }).probeId = 'probe_does_not_exist';
    const raw = {
      signals: base.signals,
      investments: base.investments,
      probes: base.probes,
      rivalTypes: Object.values(base.rivalTypes),
      rivalRules: badRules,
      events: base.events,
      inbox: base.inbox,
      intelTemplates: base.intelTemplates,
      diagnosis: base.diagnosis,
      rationales: base.rationales,
      epilogue: base.epilogue,
      policies: base.policies,
      quiz: base.quiz,
      scenario: base.scenario,
    } as unknown as RawFiles;
    expect(() => assembleContentPack(raw, SCHEMAS)).toThrow();
  });
});
