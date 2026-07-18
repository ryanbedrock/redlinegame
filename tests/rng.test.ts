import { describe, expect, it } from 'vitest';
import { draw, hash32, type RngCursors } from '../src/engine/rng';
import type { RngStream } from '../src/engine/types';

function freshCursors(): RngCursors {
  return {
    streamCursors: { rival: 0, probes: 0, events: 0, intel: 0, epilogue: 0 },
  };
}

describe('seeded RNG', () => {
  it('is reproducible for a given seed/stream/cursor', () => {
    const a = draw(42, freshCursors(), 'probes');
    const b = draw(42, freshCursors(), 'probes');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it('advances the cursor so consecutive draws differ', () => {
    const c = freshCursors();
    const first = draw(42, c, 'probes');
    const second = draw(42, c, 'probes');
    expect(first).not.toBe(second);
    expect(c.streamCursors.probes).toBe(2);
  });

  it('streams are independent (drawing one does not disturb another)', () => {
    const c = freshCursors();
    draw(42, c, 'probes');
    draw(42, c, 'probes');
    const eventsFromShared = draw(42, c, 'events');
    const eventsFromFresh = draw(42, freshCursors(), 'events');
    expect(eventsFromShared).toBe(eventsFromFresh);
  });

  it('stream seed overrides produce a distinct, reproducible sequence', () => {
    const streams: RngStream[] = ['rival', 'probes', 'events', 'intel', 'epilogue'];
    const overridden: RngCursors = {
      streamCursors: Object.fromEntries(streams.map((s) => [s, 0])) as Record<RngStream, number>,
      streamSeeds: { probes: hash32(42, 'pivot', 1, 'probes') },
    };
    const withOverride = draw(42, overridden, 'probes');
    const withoutOverride = draw(42, freshCursors(), 'probes');
    expect(withOverride).not.toBe(withoutOverride);
  });
});
