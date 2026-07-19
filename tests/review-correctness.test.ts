import { describe, expect, it } from 'vitest';
import { assembleContentPack, loadContentPack, SCHEMAS, type RawFiles } from '../src/content-loader';
import { createInitialState } from '../src/engine/setup';
import { resolveTurn } from '../src/engine/resolver';
import { applyEffect } from '../src/engine/effects';
import { isSaveCompatible, SAVE_SCHEMA_VERSION, type SaveGame } from '../src/store/persistence';
import type { ResponseType } from '../src/engine/types';
import { runCounterfactualReport } from '../src/engine/counterfactual';
import { playScripted, rushDenial } from './helpers';

const rawFrom = (
  base: ReturnType<typeof loadContentPack>,
  over: Partial<RawFiles>,
): RawFiles =>
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

// §1.2 — the engine validates the probe decision, not just the caller.
describe('§1.2 probe-response validation', () => {
  it('treats a decision naming the wrong probe as inaction (CONCEDE)', () => {
    const content = loadContentPack('scenario-1');
    const state = createInitialState(content, 3, 'T');
    const next = resolveTurn(
      state,
      {
        turn: state.meta.turnNumber,
        purchases: [],
        probeResponse: { probeId: 'probe_not_staged', responseType: 'ESCALATE', rationaleId: 'firmness' },
      },
      content,
    );
    expect(next.world.probeLog.at(-1)?.responseType).toBe('CONCEDE');
  });

  it('treats an unsupported response type as inaction (CONCEDE)', () => {
    const content = loadContentPack('scenario-1');
    const state = createInitialState(content, 3, 'T');
    const next = resolveTurn(
      state,
      {
        turn: state.meta.turnNumber,
        purchases: [],
        probeResponse: {
          probeId: state.world.stagedProbeId!,
          responseType: 'NOT_A_RESPONSE' as unknown as ResponseType,
          rationaleId: 'firmness',
        },
      },
      content,
    );
    expect(next.world.probeLog.at(-1)?.responseType).toBe('CONCEDE');
  });

  it('applies a valid response but drops a rationale that is not in its set', () => {
    const content = loadContentPack('scenario-1');
    const state = createInitialState(content, 3, 'T');
    const next = resolveTurn(
      state,
      {
        turn: state.meta.turnNumber,
        purchases: [],
        probeResponse: { probeId: state.world.stagedProbeId!, responseType: 'ENFORCE', rationaleId: 'nonsense' },
      },
      content,
    );
    expect(next.world.probeLog.at(-1)?.responseType).toBe('ENFORCE');
    const rec = next.analytics.decisions.find((d) => d.kind === 'PROBE_RESPONSE');
    expect(rec?.rationaleId).toBeUndefined();
  });

  it('records a valid rationale that belongs to the response set', () => {
    const content = loadContentPack('scenario-1');
    const state = createInitialState(content, 3, 'T');
    const next = resolveTurn(
      state,
      {
        turn: state.meta.turnNumber,
        purchases: [],
        probeResponse: { probeId: state.world.stagedProbeId!, responseType: 'ENFORCE', rationaleId: 'firmness' },
      },
      content,
    );
    const rec = next.analytics.decisions.find((d) => d.kind === 'PROBE_RESPONSE');
    expect(rec?.rationaleId).toBe('firmness');
  });
});

// §1.3 — save schema version is checked, not just written.
describe('§1.3 save compatibility', () => {
  const mk = (v: string): SaveGame => ({
    schemaVersion: v,
    id: 'x',
    scenarioId: 'scenario-1',
    seed: 1,
    createdAt: 'a',
    updatedAt: 'b',
    decisionLog: [],
  });
  it('accepts the current version', () => {
    expect(isSaveCompatible(mk(SAVE_SCHEMA_VERSION))).toBe(true);
  });
  it('accepts a patch-level difference', () => {
    expect(isSaveCompatible(mk('1.2.99'))).toBe(true);
  });
  it('rejects an older minor version whose replay semantics differ', () => {
    expect(isSaveCompatible(mk('1.1.0'))).toBe(false);
  });
  it('rejects a malformed / missing version', () => {
    expect(isSaveCompatible(mk(''))).toBe(false);
    expect(isSaveCompatible({ ...mk('1.2.0'), schemaVersion: undefined as unknown as string })).toBe(false);
  });
});

// §1.4 — content validation rejects inert effect shapes; PC clamps to pcCap.
describe('§1.4 effect validation & clamping', () => {
  it('rejects durationTurns on an immediate stock target', () => {
    const base = loadContentPack('scenario-1');
    const events = structuredClone(base.events) as { effects: unknown[] }[];
    events[0].effects = [{ target: 'budget', op: 'add', value: 5, durationTurns: 3 }];
    expect(() => assembleContentPack(rawFrom(base, { events } as Partial<RawFiles>), SCHEMAS)).toThrow();
  });

  it('rejects an add/set modifier on a multiplicatively-read flow target', () => {
    const base = loadContentPack('scenario-1');
    const events = structuredClone(base.events) as { effects: unknown[] }[];
    events[0].effects = [{ target: 'budgetIncome', op: 'add', value: 2 }];
    expect(() => assembleContentPack(rawFrom(base, { events } as Partial<RawFiles>), SCHEMAS)).toThrow();
  });

  it('clamps a political-capital effect to the scenario pcCap, not 100', () => {
    const content = loadContentPack('scenario-1');
    const cap = content.scenario.tuning.pcCap;
    const state = createInitialState(content, 1, 'T');
    state.player.politicalCapital = cap - 1;
    applyEffect(state, { target: 'politicalCapital', op: 'add', value: 999 }, 'test', 1, cap);
    expect(state.player.politicalCapital).toBe(cap);
  });
});

// §1.1 / PR#7 regressions — scheduled events don't vanish; pivots are real.
describe('scheduled-event scheduling (no starvation)', () => {
  it('fires every scheduled event even when windows overlap and collide', () => {
    const base = loadContentPack('scenario-1');
    const scenario = structuredClone(base.scenario) as { beats: { eventId: string; minTurn: number; maxTurn: number }[] };
    // Force three of the four beats into one narrow, shared window so multiple
    // events routinely roll to the same quarter and hit the ≤2-per-turn cap.
    const shared = { minTurn: 4, maxTurn: 6 };
    scenario.beats = scenario.beats.map((b, i) =>
      i < 3 ? { eventId: b.eventId, ...shared } : b,
    );
    const content = assembleContentPack(
      rawFrom(base, { scenario } as unknown as Partial<RawFiles>),
      SCHEMAS,
    );
    const windowed = scenario.beats.slice(0, 3).map((b) => b.eventId);
    for (let seed = 1; seed <= 40; seed++) {
      const { state } = playScripted(content, seed, { probe: 'MATCH', buys: rushDenial });
      const fired = new Set(state.world.eventLog.map((e) => e.eventId));
      for (const id of windowed) {
        expect(fired.has(id), `seed ${seed} dropped ${id}`).toBe(true);
      }
    }
  });
});

// PR#7 finding #2 — pivots must land on quarters the player actually faced a
// probe, so the "recorded → alternative" flip is a real, flippable action.
describe('pivots are anchored to recorded probe responses', () => {
  it('never selects a quarter with no recorded probe response', () => {
    const content = loadContentPack('scenario-1');
    for (const seed of [1, 7, 42, 1337]) {
      const live = playScripted(content, seed, { probe: 'MATCH', buys: rushDenial });
      const probeTurns = new Set(
        live.decisions.filter((d) => d.probeResponse).map((d) => d.turn),
      );
      const report = runCounterfactualReport(content, seed, live.decisions, live.state.rival.type);
      for (const p of report.pivots) {
        expect(probeTurns.has(p.pivot.turn), `seed ${seed} pivot on probe-free turn ${p.pivot.turn}`).toBe(
          true,
        );
      }
    }
  });
});
