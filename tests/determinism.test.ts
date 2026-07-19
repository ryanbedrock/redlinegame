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
        hash: 'b475e0d28597ac0af9142a68370bd22325a654a9778fd44c13a543cc34eec744',
      },
      {
        seed: 7,
        cfg: { probe: 'CONCEDE', buys: rushDenial },
        ending: 'CAPITULATION',
        hash: '6d7fbc5dcfaf2e584439c7aa0548e5ff82624722e3f5109393928a60b9aa42a9',
      },
      {
        seed: 1,
        cfg: { probe: 'MATCH' },
        ending: 'WAR',
        hash: '791adfa4145ddc452b4b5aed76f3b30e3ce1eb22bf220800d13027502b9cf969',
      },
    ];
    for (const g of golden) {
      const { state } = playScripted(content, g.seed, g.cfg);
      expect(state.meta.ending, `seed ${g.seed} ending`).toBe(g.ending);
      expect(hashState(state), `seed ${g.seed} hash`).toBe(g.hash);
    }
  });
});
