import { describe, expect, it } from 'vitest';
import { hashState } from '../src/engine/analytics';
import { pack, playScripted, rushDenial } from './helpers';

// AC-1: identical seed + identical decisions ⇒ bit-identical outcome.
describe('AC-1 determinism', () => {
  const content = pack();
  const cfg = { probe: 'MATCH' as const, buys: rushDenial };

  it('same seed + same decisions produce identical state hashes', () => {
    const a = playScripted(content, 1, cfg);
    const b = playScripted(content, 1, cfg);
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(a.state.meta.ending).toBe(b.state.meta.ending);
  });

  it('different seeds diverge', () => {
    const a = playScripted(content, 1, cfg);
    const b = playScripted(content, 2, cfg);
    expect(hashState(a.state)).not.toBe(hashState(b.state));
  });

  it('hash is stable across createdAt / displayName changes', () => {
    const a = playScripted(content, 3, cfg);
    const clone = structuredClone(a.state);
    clone.meta.createdAt = 'different';
    clone.meta.displayName = 'someone';
    expect(hashState(clone)).toBe(hashState(a.state));
  });
});
