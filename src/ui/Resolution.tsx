// Resolution — the after-action for the quarter just committed. Reports only
// player-visible consequences (resource deltas, events, and whether an ending
// was reached). Hidden ledgers are never shown here.

import { useGameStore } from '../store/gameStore';
import { signed, TRACK_LABEL } from './format';
import type { TrackId } from '../engine/types';

const ENDING_COPY: Record<string, { title: string; tone: string; blurb: string }> = {
  DETERRENCE_HOLD: {
    title: 'Deterrence Holds',
    tone: 'good',
    blurb: 'The Rival was neither emboldened into aggression nor frightened into a spiral. The line held.',
  },
  WAR: {
    title: 'The Red Line Is Crossed',
    tone: 'bad',
    blurb: 'Deterrence has failed. The conflict now moves to its opening campaign — your prior investments will shape how it goes.',
  },
  CAPITULATION: {
    title: 'Capitulation',
    tone: 'warn',
    blurb: 'War was averted, but the status quo has been hollowed out by accumulated concessions. You held the peace and lost the position.',
  },
};

export function Resolution(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const resolvedTurn = useGameStore((s) => s.resolvedTurn);
  const cont = useGameStore((s) => s.continueAfterResolution);

  if (!state || !content) return null;

  const record =
    state.analytics.turnRecords.find((r) => r.turn === resolvedTurn) ??
    state.analytics.turnRecords[state.analytics.turnRecords.length - 1];

  const ending = record?.endingAfter ?? state.meta.ending;
  const trackIds: TrackId[] = ['denial', 'punishment', 'intelligence', 'readiness'];

  return (
    <div className="screen resolution">
      <h2 className="screen-title">Quarter Resolved</h2>

      {ending && ENDING_COPY[ending] && (
        <div className={`ending-banner ${ENDING_COPY[ending].tone}`} role="status">
          <h3>{ENDING_COPY[ending].title}</h3>
          <p>{ENDING_COPY[ending].blurb}</p>
        </div>
      )}

      {record ? (
        <>
          <section className="panel">
            <h3>Movements</h3>
            <div className="delta-grid">
              <div className="delta">
                <span>Budget</span>
                <strong className={record.deltas.budget >= 0 ? 'up' : 'down'}>{signed(record.deltas.budget)}</strong>
              </div>
              <div className="delta">
                <span>Political Capital</span>
                <strong className={record.deltas.politicalCapital >= 0 ? 'up' : 'down'}>
                  {signed(record.deltas.politicalCapital)}
                </strong>
              </div>
              <div className="delta">
                <span>Status Quo</span>
                <strong className={record.deltas.statusQuoIntegrity >= 0 ? 'up' : 'down'}>
                  {signed(record.deltas.statusQuoIntegrity)}
                </strong>
              </div>
            </div>
            {trackIds.some((t) => record.deltas.tracks[t] !== 0) && (
              <div className="delta-grid tracks">
                {trackIds
                  .filter((t) => record.deltas.tracks[t] !== 0)
                  .map((t) => (
                    <div className="delta" key={t}>
                      <span>{TRACK_LABEL[t]}</span>
                      <strong className="up">{signed(record.deltas.tracks[t])}</strong>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {record.eventIds.length > 0 && (
            <section className="panel">
              <h3>Developments</h3>
              <ul className="event-list">
                {record.eventIds.map((id) => {
                  const ev = content.events.find((e) => e.id === id);
                  return (
                    <li key={id}>
                      <span className="event-title">{ev?.title ?? id}</span>
                      {ev?.text && <p className="muted">{ev.text}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="muted">No changes recorded.</p>
      )}

      <div className="screen-actions">
        <button type="button" className="primary" onClick={cont}>
          {ending === 'WAR'
            ? 'Proceed to the Opening Campaign →'
            : ending
              ? 'View Debrief →'
              : 'Next Quarter →'}
        </button>
      </div>
    </div>
  );
}
