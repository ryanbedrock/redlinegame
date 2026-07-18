// ============================================================================
// Seeded, counter-based RNG (PRD §6.5, §6.12).
//
// Per draw:  seed = xmur3(`${masterSeed}:${stream}:${cursor}`)()
//            value = mulberry32(seed)()   then increment the stream cursor.
//
// xmur3 and mulberry32 are vendored public-domain reference implementations.
// Pure module (AC-2): no Math.random, no Date, no I/O.
// ============================================================================

import type { RngStream } from './types';

// xmur3 string hash — public domain (bryc).
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32 PRNG — public domain (bryc).
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 32-bit hash of arbitrary parts — used to seed pivot sub-seeds
// (§6.12: hash32(masterSeed, pivotId, k, streamName)).
export function hash32(...parts: (string | number)[]): number {
  return xmur3(parts.join(':'))();
}

export interface RngCursors {
  streamCursors: Record<RngStream, number>;
  // Per-stream seed overrides installed by the counterfactual engine for
  // sub-seeded pivots (§6.12). Absent in normal play.
  streamSeeds?: Partial<Record<RngStream, number>>;
}

// Draw a float in [0,1) from the named stream, mutating the cursor map. The
// effective seed is the stream override if present, else the master seed.
export function draw(
  masterSeed: number,
  cursors: RngCursors,
  stream: RngStream,
): number {
  const effectiveSeed = cursors.streamSeeds?.[stream] ?? masterSeed;
  const cursor = cursors.streamCursors[stream];
  const seed = xmur3(`${effectiveSeed}:${stream}:${cursor}`)();
  const value = mulberry32(seed)();
  cursors.streamCursors[stream] = cursor + 1;
  return value;
}

// Inclusive integer roll in [min, max]. min >= max ⇒ deterministic, no draw
// consumed (keeps the golden master stable regardless of content shape).
export function rollInt(
  masterSeed: number,
  cursors: RngCursors,
  stream: RngStream,
  min: number,
  max: number,
): number {
  if (min >= max) return min;
  const v = draw(masterSeed, cursors, stream);
  return min + Math.floor(v * (max - min + 1));
}

// Symmetric noise in [-mag, +mag] (additive), one draw.
export function noiseAdditive(
  masterSeed: number,
  cursors: RngCursors,
  stream: RngStream,
  mag: number,
): number {
  if (mag <= 0) return 0;
  const v = draw(masterSeed, cursors, stream);
  return (v * 2 - 1) * mag;
}
