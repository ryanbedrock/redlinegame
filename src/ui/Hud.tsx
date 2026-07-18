// Persistent command-bar: resources, force posture, and quarter clock. Shows
// only player-visible state — never the hidden Rival ledgers or type.

import { useGameStore } from '../store/gameStore';
import { TRACK_IDS } from '../engine/types';
import { TRACK_LABEL, TRACK_BLURB, quarterLabel } from './format';

export function Hud(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const stage = useGameStore((s) => s.stage);
  const goToStage = useGameStore((s) => s.goToStage);
  const backToMenu = useGameStore((s) => s.backToMenu);
  const seenMessageIds = useGameStore((s) => s.seenMessageIds);

  if (!state || !content) return null;

  const seen = new Set(seenMessageIds);
  const unread = state.world.inbox.filter((m) => !m.respondedWith && !seen.has(m.id)).length;
  const planning = stage === 'SITREP' || stage === 'PROBE' || stage === 'SIGNALS' || stage === 'INBOX' || stage === 'ASSESSMENT';
  const sq = state.world.statusQuoIntegrity;
  const sqTone = sq <= 25 ? 'danger' : sq <= 50 ? 'warn' : 'good';

  return (
    <header className="hud">
      <div className="hud-left">
        <div className="hud-title">
          <span className="brand">THE RED LINE</span>
          <span className="scenario">{content.scenario.name}</span>
        </div>
        <div className="hud-clock">{quarterLabel(state.meta.turnNumber, content.scenario.turnCount)}</div>
      </div>

      <div className="hud-resources">
        <div className="res">
          <span className="res-label">Budget</span>
          <span className="res-val">{Math.round(state.player.budget)}</span>
        </div>
        <div className="res">
          <span className="res-label">Political Capital</span>
          <span className="res-val">{Math.round(state.player.politicalCapital)}</span>
        </div>
        <div className="res">
          <span className="res-label">Status Quo</span>
          <span className={`res-val sq-${sqTone}`}>{Math.round(sq)}</span>
        </div>
      </div>

      <div className="hud-tracks">
        {TRACK_IDS.map((t) => (
          <div key={t} className="track-chip" title={TRACK_BLURB[t]}>
            <span className="track-name">{TRACK_LABEL[t]}</span>
            <span className="track-level">{state.player.tracks[t]}</span>
          </div>
        ))}
      </div>

      {planning && (
        <nav className="hud-nav" aria-label="Command actions">
          <button type="button" className={stage === 'INBOX' ? 'active' : ''} onClick={() => goToStage('INBOX')}>
            Inbox{unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <button type="button" className={stage === 'ASSESSMENT' ? 'active' : ''} onClick={() => goToStage('ASSESSMENT')}>
            Assessment
          </button>
          <button type="button" className="ghost" onClick={backToMenu}>
            Menu
          </button>
        </nav>
      )}
    </header>
  );
}
