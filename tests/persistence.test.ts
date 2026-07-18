import { describe, expect, it } from 'vitest';
import { pack, playScripted, rushDenial } from './helpers';
import { hashState } from '../src/engine/analytics';
import { replay, SAVE_SCHEMA_VERSION, type SaveGame } from '../src/store/persistence';

// Event-sourced save/resume: replaying the seed + decision log through the pure
// engine reproduces the exact live state (a save stores no derived state).
describe('save/resume replay identity', () => {
  const content = pack();

  const buildSave = (seed: number, decisions: SaveGame['decisionLog']): SaveGame => ({
    schemaVersion: SAVE_SCHEMA_VERSION,
    id: `test-${seed}`,
    scenarioId: 'scenario-1',
    seed,
    createdAt: 'TEST_CREATED_AT',
    updatedAt: 'TEST_CREATED_AT',
    decisionLog: decisions,
  });

  it('reproduces a campaign that ends in capitulation exactly', () => {
    const { state, decisions } = playScripted(content, 1, { probe: 'CONCEDE', buys: rushDenial });
    const replayed = replay(content, buildSave(1, decisions));
    expect(hashState(replayed)).toBe(hashState(state));
    expect(replayed.meta.ending).toBe('CAPITULATION');
    expect(replayed.meta.phase).toBe('DEBRIEF');
  });

  it('reproduces a deterrence-hold campaign exactly', () => {
    const { state, decisions } = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const replayed = replay(content, buildSave(2, decisions));
    expect(hashState(replayed)).toBe(hashState(state));
    expect(replayed.meta.ending).toBe('DETERRENCE_HOLD');
  });

  it('a partial decision log replays to a mid-campaign state', () => {
    const { decisions } = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    const partial = replay(content, buildSave(2, decisions.slice(0, 5)));
    expect(partial.meta.phase).not.toBe('DEBRIEF');
    expect(partial.analytics.turnRecords.length).toBe(5);
  });
});
