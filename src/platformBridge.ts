// Handshake and persistence bridge to the Bedrock platform when the game runs
// inside its GameIFrame. Message shapes mirror the platform's IFrameRequest
// protocol (type + optional gameId); saves and completion reports go over
// same-origin fetch so the platform session cookie authenticates them.
// Outside an iframe these are no-ops, so the game runs standalone unchanged.

import type { GameState, TurnDecisions } from './engine';

const GAME_ID_PARAM = 'gameId';
const DEFAULT_GAME_ID = 'red-line';
const STATE_URL = '/games/red-line/state';
const COMPLETE_URL = '/games/red-line/complete';

/** Campaign snapshot stored verbatim in the platform's UserGameActivity.data. */
export interface PlatformSave {
  version: 1;
  state: GameState;
  committed: TurnDecisions[];
}

export interface PlatformCompletion {
  ending: 'DETERRENCE_HOLD' | 'CAPITULATION' | 'WAR';
  compositeScore: number;
  scenarioId: string;
  quartersPlayed: number;
}

function embedded(): boolean {
  return window.parent !== window;
}

function platformGameId(): string {
  return new URLSearchParams(window.location.search).get(GAME_ID_PARAM) ?? DEFAULT_GAME_ID;
}

/** Tell the host page the game booted, so it can record an Experienced xAPI statement. */
export function notifyPlatformLoaded(): void {
  if (!embedded()) return;
  window.parent.postMessage(
    { type: 'game_loaded_successfully', gameId: platformGameId() },
    window.location.origin,
  );
}

/** Ask the host page to navigate back to its games list. */
export function requestPlatformExit(): void {
  if (!embedded()) return;
  window.parent.postMessage({ type: 'reload_games_page' }, window.location.origin);
}

/** True when the game runs inside the platform, so saves have somewhere to go. */
export function platformAvailable(): boolean {
  return embedded();
}

function isPlatformSave(value: unknown): value is PlatformSave {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<PlatformSave>;
  return (
    save.version === 1 &&
    !!save.state &&
    typeof save.state === 'object' &&
    typeof save.state.meta?.scenarioId === 'string' &&
    Array.isArray(save.committed)
  );
}

/** Fetch the saved campaign, if any. Returns null standalone or on any failure. */
export async function fetchPlatformSave(): Promise<PlatformSave | null> {
  if (!embedded()) return null;
  try {
    const res = await fetch(STATE_URL, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const body = (await res.json()) as { save?: unknown };
    return isPlatformSave(body.save) ? body.save : null;
  } catch {
    return null;
  }
}

/** Persist the campaign snapshot after a committed quarter. Fire-and-forget. */
export function pushPlatformSave(save: PlatformSave): void {
  if (!embedded()) return;
  void fetch(STATE_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(save),
  }).catch(() => undefined);
}

/** Report the terminal result once the debrief is reached. Fire-and-forget. */
export function postPlatformComplete(result: PlatformCompletion): void {
  if (!embedded()) return;
  void fetch(COMPLETE_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  }).catch(() => undefined);
}
