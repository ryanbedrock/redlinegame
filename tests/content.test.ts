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

  // scenario.beats is authoritative for event timing.
  const rawFrom = (base: ReturnType<typeof loadContentPack>, over: Partial<RawFiles>): RawFiles =>
    ({
      signals: base.signals,
      investments: base.investments,
      probes: base.probes,
      rivalTypes: Object.values(base.rivalTypes),
      rivalRules: base.rivalRules,
      events: base.events,
      inbox: base.inbox,
      intelTemplates: base.intelTemplates,
      diagnosis: base.diagnosis,
      rationales: base.rationales,
      epilogue: base.epilogue,
      policies: base.policies,
      quiz: base.quiz,
      scenario: base.scenario,
      ...over,
    }) as unknown as RawFiles;

  it('rejects an event that carries its own stale schedule', () => {
    const base = loadContentPack('scenario-1');
    const events = structuredClone(base.events) as unknown[];
    (events[0] as { schedule: unknown }).schedule = { minTurn: 1, maxTurn: 3 };
    expect(() => assembleContentPack(rawFrom(base, { events } as Partial<RawFiles>), SCHEMAS)).toThrow();
  });

  it('rejects an event that is neither scheduled by a beat nor conditional (unreachable)', () => {
    const base = loadContentPack('scenario-1');
    const events = structuredClone(base.events) as { id: string; condition?: unknown }[];
    const scenario = structuredClone(base.scenario) as { beats: { eventId: string }[] };
    // Strip both the beat and the condition for one event.
    const target = scenario.beats[0].eventId;
    scenario.beats = scenario.beats.filter((b) => b.eventId !== target);
    const ev = events.find((e) => e.id === target);
    if (ev) delete ev.condition;
    expect(() =>
      assembleContentPack(rawFrom(base, { events, scenario } as unknown as Partial<RawFiles>), SCHEMAS),
    ).toThrow();
  });

  it('rejects a beat whose minTurn exceeds its maxTurn', () => {
    const base = loadContentPack('scenario-1');
    const scenario = structuredClone(base.scenario) as { beats: { minTurn: number; maxTurn: number }[] };
    scenario.beats[0] = { ...scenario.beats[0], minTurn: 20, maxTurn: 3 };
    expect(() =>
      assembleContentPack(rawFrom(base, { scenario } as unknown as Partial<RawFiles>), SCHEMAS),
    ).toThrow();
  });
});
