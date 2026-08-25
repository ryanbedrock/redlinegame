// Handshake with the Bedrock platform when the game runs inside its
// GameIFrame. Message shapes mirror the platform's IFrameRequest protocol
// (type + optional gameId). Outside an iframe these are no-ops, so the game
// runs standalone unchanged.

const GAME_ID_PARAM = 'gameId';
const DEFAULT_GAME_ID = 'red-line';

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
