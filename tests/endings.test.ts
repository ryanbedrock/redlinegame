import { describe, expect, it } from 'vitest';
import { pack, playScripted, rushDenial } from './helpers';

// AC-4 / AC-5: all three campaign endings are reachable.
describe('AC-4/AC-5 endings reachable', () => {
  const content = pack();

  it('reaches DETERRENCE_HOLD with early denial + firm responses', () => {
    const { state } = playScripted(content, 2, { probe: 'MATCH', buys: rushDenial });
    expect(state.meta.ending).toBe('DETERRENCE_HOLD');
    expect(state.meta.phase).toBe('DEBRIEF');
  });

  it('reaches WAR when appeasing a pressured expansionist', () => {
    const { state } = playScripted(content, 2, { probe: 'CONCEDE' });
    expect(state.meta.ending).toBe('WAR');
  });

  it('reaches CAPITULATION: strong denial averts war but concessions erode the status quo', () => {
    const { state } = playScripted(content, 1, { probe: 'CONCEDE', buys: rushDenial });
    expect(state.meta.ending).toBe('CAPITULATION');
    expect(state.world.statusQuoIntegrity).toBeLessThanOrEqual(0);
  });

  it('runs a full four-decision war epilogue before the debrief', () => {
    const { state } = playScripted(content, 2, { probe: 'CONCEDE' });
    expect(state.meta.ending).toBe('WAR');
    expect(state.epilogue?.decisionsTaken.length).toBe(content.epilogue.decisions.length);
    expect(state.meta.phase).toBe('DEBRIEF');
  });
});
