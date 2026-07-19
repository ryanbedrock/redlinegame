// ============================================================================
// Event-sourced save/resume (PRD §8). A save is the seed + the ordered log of
// per-turn decisions; the full GameState is reconstructed by replaying the pure
// resolver over that log. This keeps saves tiny and guarantees a resumed game
// is bit-identical to the original for the SAME engine version (determinism,
// AC-1). Because replay is engine-defined, a save is only reproducible under a
// compatible schema version — see `isSaveCompatible` / `SAVE_SCHEMA_VERSION`.
// localStorage is the only persistence layer — no backend, no network.
// ============================================================================

import type { ContentPack, GameState, TurnDecisions } from '../engine/types';
import { createInitialState } from '../engine/setup';
import { resolveTurn, resolveEpilogueTurn } from '../engine/resolver';

// Bumped to 1.2.0: controlled randomness (seeded event-beat timing + probe
// variant draws) changed replay semantics, so decision logs recorded under an
// earlier engine no longer reconstruct the same campaign. Bump the MAJOR.MINOR
// whenever replay semantics change; PATCH is reserved for non-replay-affecting
// changes.
export const SAVE_SCHEMA_VERSION = '1.2.0';

// A save replays identically only under an engine whose schema shares the same
// MAJOR.MINOR. A newer/older/malformed version is treated as incompatible so
// the UI can offer discard-or-restart rather than silently mis-replaying into a
// campaign that differs from the one the player left (§1.3).
export function isSaveCompatible(save: SaveGame): boolean {
  const parse = (v: string): [number, number] | null => {
    const m = /^(\d+)\.(\d+)\./.exec(v);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const cur = parse(SAVE_SCHEMA_VERSION);
  const got = parse(save.schemaVersion ?? '');
  if (!cur || !got) return false;
  return got[0] === cur[0] && got[1] === cur[1];
}

export interface SaveGame {
  schemaVersion: string;
  id: string;
  scenarioId: string;
  seed: number;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  decisionLog: TurnDecisions[];
}

const INDEX_KEY = 'redline:saves';
const SAVE_PREFIX = 'redline:save:';

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

// Fold the decision log through the pure engine to rebuild the live state. The
// current phase decides whether a decision is a normal turn or an epilogue turn.
export function replay(content: ContentPack, save: SaveGame): GameState {
  let state = createInitialState(content, save.seed, save.createdAt, save.displayName);
  for (const decision of save.decisionLog) {
    if (state.meta.phase === 'DEBRIEF') break;
    state =
      state.meta.phase === 'EPILOGUE'
        ? resolveEpilogueTurn(state, decision, content)
        : resolveTurn(state, decision, content);
  }
  return state;
}

export function listSaves(): SaveGame[] {
  const s = storage();
  if (!s) return [];
  const raw = s.getItem(INDEX_KEY);
  if (!raw) return [];
  let ids: string[];
  try {
    ids = JSON.parse(raw) as string[];
  } catch {
    return [];
  }
  const saves: SaveGame[] = [];
  for (const id of ids) {
    const save = loadSave(id);
    if (save) saves.push(save);
  }
  saves.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return saves;
}

export function loadSave(id: string): SaveGame | null {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(SAVE_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveGame;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveGame): void {
  const s = storage();
  if (!s) return;
  s.setItem(SAVE_PREFIX + save.id, JSON.stringify(save));
  const ids = new Set(indexIds(s));
  ids.add(save.id);
  s.setItem(INDEX_KEY, JSON.stringify([...ids]));
}

export function deleteSave(id: string): void {
  const s = storage();
  if (!s) return;
  s.removeItem(SAVE_PREFIX + id);
  const ids = indexIds(s).filter((x) => x !== id);
  s.setItem(INDEX_KEY, JSON.stringify(ids));
}

function indexIds(s: Storage): string[] {
  const raw = s.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function newSaveId(scenarioId: string, seed: number): string {
  return `${scenarioId}-${seed}-${Date.now().toString(36)}`;
}
