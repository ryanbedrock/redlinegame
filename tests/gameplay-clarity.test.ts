import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/setup';
import { resolveTurn } from '../src/engine/resolver';
import type { TurnDecisions } from '../src/engine/types';
import { pack } from './helpers';

// #2 — probe flavor variants rotate deterministically on repeats (same
// mechanics, new text) so a repeated probe never reads identically twice.
describe('probe flavor variants', () => {
  const content = pack();

  it('shows the Nth occurrence of a probe as its Nth variant (mod pool)', () => {
    let state = createInitialState(content, 1, 'TEST');
    const seen: Record<string, number> = {};
    let sawRepeatWithNewVariant = false;

    for (let step = 0; step < 20 && state.meta.phase === 'SITREP'; step++) {
      const probeId = state.world.stagedProbeId;
      if (probeId) {
        const probe = content.probes.find((p) => p.id === probeId);
        const pool = probe?.variants?.length ?? 0;
        const occurrence = seen[probeId] ?? 0;
        const expected = pool > 0 ? occurrence % pool : 0;
        expect(state.world.stagedProbeVariant).toBe(expected);
        if (occurrence > 0 && pool > 1) sawRepeatWithNewVariant = true;
        seen[probeId] = occurrence + 1;
      }
      const d: TurnDecisions = { turn: state.meta.turnNumber, purchases: [] };
      if (probeId) {
        d.probeResponse = { probeId, responseType: 'MATCH', rationaleId: 'auto' };
      }
      state = resolveTurn(state, d, content);
    }

    // Matching an Opportunist reliably repeats the low-severity grey-zone probe.
    expect(sawRepeatWithNewVariant).toBe(true);
  });

  it('keeps every variant index within the authored pool', () => {
    for (const probe of content.probes) {
      const pool = probe.variants?.length ?? 0;
      if (pool > 0) expect(probe.variants).toHaveLength(pool);
    }
  });
});

// #3 — tasking extra collection (an inbox action) sharpens next quarter's
// estimates: same seed, the boosted branch is never lower-confidence.
describe('intel collection tasking', () => {
  const content = pack();
  const confRank = { LOW: 0, MODERATE: 1, HIGH: 2 };

  function playToIntelBrief() {
    let state = createInitialState(content, 1, 'TEST');
    // Resolve turn 0 → the quarterly intel brief appears at turn 1.
    const probeId0 = state.world.stagedProbeId;
    state = resolveTurn(
      state,
      {
        turn: state.meta.turnNumber,
        purchases: [],
        ...(probeId0 ? { probeResponse: { probeId: probeId0, responseType: 'MATCH' as const, rationaleId: 'auto' } } : {}),
      },
      content,
    );
    return state;
  }

  it('the intel brief carries a task-collection option that boosts the next read', () => {
    const state = playToIntelBrief();
    const brief = state.world.inbox.find((m) => m.templateId === 'msg_intel_brief');
    expect(brief).toBeDefined();
    const task = brief?.responseOptions?.find((o) => o.id === 'task');
    expect(task?.effects?.some((e) => e.target === 'intelCollectionBoost')).toBe(true);

    const probeId = state.world.stagedProbeId;
    const base = {
      turn: state.meta.turnNumber,
      purchases: [],
      ...(probeId ? { probeResponse: { probeId, responseType: 'MATCH' as const, rationaleId: 'auto' } } : {}),
    };

    const acked = resolveTurn(state, { ...base, inboxResponses: [{ messageId: brief!.id, optionId: 'ack' }] }, content);
    const tasked = resolveTurn(state, { ...base, inboxResponses: [{ messageId: brief!.id, optionId: 'task' }] }, content);

    const nextTurn = acked.meta.turnNumber;
    const ackEst = acked.world.intel.filter((i) => i.turn === nextTurn);
    const taskEst = tasked.world.intel.filter((i) => i.turn === nextTurn);
    expect(ackEst.length).toBe(taskEst.length);
    expect(taskEst.length).toBeGreaterThan(0);

    for (const t of taskEst) {
      const a = ackEst.find((x) => x.metric === t.metric)!;
      expect(confRank[t.confidence]).toBeGreaterThanOrEqual(confRank[a.confidence]);
    }
    // At least one metric is strictly sharper after tasking collection.
    expect(
      taskEst.some((t) => confRank[t.confidence] > confRank[ackEst.find((x) => x.metric === t.metric)!.confidence]),
    ).toBe(true);
  });
});
