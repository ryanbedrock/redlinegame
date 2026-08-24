import { TRACK_IDS, type ContentPack, type GameState } from '../engine';
import { useGameStore } from '../store/gameStore';

export const TRACK_LABELS: Record<string, string> = {
  denial: 'Denial',
  punishment: 'Punishment',
  intelligence: 'Intelligence',
  readiness: 'Readiness',
};

export function Hud({ state, content }: { state: GameState; content: ContentPack }): JSX.Element {
  const reset = useGameStore((s) => s.reset);
  const turnLabel = Math.min(state.meta.turnNumber + 1, content.scenario.turnCount);

  return (
    <header className="hud">
      <div className="hud-title">
        <h1>The Red Line</h1>
        <p className="subtitle">
          {content.scenario.name} · Quarter {turnLabel} of {content.scenario.turnCount}
        </p>
      </div>
      <div className="hud-stats">
        <div className="stat">
          <span className="stat-label">Budget</span>
          <span className="stat-value">{state.player.budget.toFixed(1)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Political capital</span>
          <span className="stat-value">{state.player.politicalCapital.toFixed(1)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Status quo</span>
          <span className="stat-value">{state.world.statusQuoIntegrity.toFixed(0)}</span>
        </div>
        {TRACK_IDS.map((t) => (
          <div className="stat" key={t}>
            <span className="stat-label">{TRACK_LABELS[t]}</span>
            <span className="stat-value">{state.player.tracks[t]}</span>
          </div>
        ))}
      </div>
      <button className="ghost" onClick={reset}>
        Abandon game
      </button>
    </header>
  );
}
