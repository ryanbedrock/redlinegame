import { describe, expect, it } from 'vitest';
import { hashState } from '../src/engine/analytics';
import { pack, playScripted, rushDenial, type PlayConfig } from './helpers';

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

  // Golden master: pinned final-state hashes for fixed campaigns. These are the
  // concrete "expected hash" the tamper/drift claims rely on — a change here
  // means replay semantics moved and SAVE_SCHEMA_VERSION must be bumped
  // alongside the pin. One case per ending covers the main branches.
  it('reproduces pinned golden-master hashes (drift guard)', () => {
    const golden: { seed: number; cfg: PlayConfig; ending: string; hash: string }[] = [
      {
        seed: 1,
        cfg: { probe: 'MATCH', buys: rushDenial },
        ending: 'DETERRENCE_HOLD',
        hash: '09fa19ff6c9b6efeb8628987088139a884b94ed889b2a1c19e0da89e02472e26',
      },
      {
        seed: 7,
        cfg: { probe: 'CONCEDE', buys: rushDenial },
        ending: 'CAPITULATION',
        hash: '46511ff5cf60ef107518188b8283d0a898c7a719b8ac467770fbf941342dbba3',
      },
      {
        seed: 1,
        cfg: { probe: 'MATCH' },
        ending: 'WAR',
        hash: '995c184c4485a60ffada2556dffc9626bc8ad0dff41f84e660bffc48754545ec',
      },
    ];
    for (const g of golden) {
      const { state } = playScripted(content, g.seed, g.cfg);
      expect(state.meta.ending, `seed ${g.seed} ending`).toBe(g.ending);
      expect(hashState(state), `seed ${g.seed} hash`).toBe(g.hash);
    }
  });
});
