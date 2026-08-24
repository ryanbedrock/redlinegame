import type { ContentPack, GameState, IntelEstimate } from '../engine';
import { useGameStore } from '../store/gameStore';
import { Hud, TRACK_LABELS } from './Hud';

const METRIC_LABELS: Record<string, string> = {
  RESOLVE_READ: 'Their read of our resolve',
  CAPABILITY_READ: 'Their read of our capability',
  INTENT_ASSESSMENT: 'Assessed hostile intent',
  ARMING_READ: 'Rival arming level',
};

function intelBody(est: IntelEstimate, content: ContentPack): string {
  const tmpl = content.intelTemplates.find((t) => t.id === est.sourceFlavorId);
  const value = est.value.toFixed(2);
  if (!tmpl) return `${METRIC_LABELS[est.metric] ?? est.metric}: ${value}`;
  return tmpl.body.replace('{value}', value);
}

export function Sitrep({
  state,
  content,
}: {
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const setView = useGameStore((s) => s.setView);
  const draft = useGameStore((s) => s.draft);
  const stageInboxResponse = useGameStore((s) => s.stageInboxResponse);

  const turn = state.meta.turnNumber;
  const latestIntel = state.world.intel.filter((i) => i.turn === turn);
  const inbox = state.world.inbox.filter((m) => m.turn === turn);
  const pending = state.player.pendingInvestments;
  const standing = state.player.commitmentRegister;

  return (
    <div className="screen">
      <Hud state={state} content={content} />
      <h2 className="phase-heading">Situation report</h2>
      <div className="grid">
        <section className="panel">
          <h3>Posture</h3>
          <table className="table">
            <tbody>
              {Object.entries(state.player.tracks).map(([track, level]) => (
                <tr key={track}>
                  <td>{TRACK_LABELS[track] ?? track}</td>
                  <td className="num">{level}</td>
                </tr>
              ))}
              <tr>
                <td>Status-quo integrity</td>
                <td className="num">{state.world.statusQuoIntegrity.toFixed(0)}</td>
              </tr>
              <tr>
                <td>Concession streak</td>
                <td className="num">{state.world.concessionStreak}</td>
              </tr>
            </tbody>
          </table>
          {pending.length > 0 && (
            <>
              <h4>In the pipeline</h4>
              <ul className="plain">
                {pending.map((p, i) => (
                  <li key={`${p.trackOrSignalId}-${i}`}>
                    {content.cardsById[p.trackOrSignalId]?.title ?? p.trackOrSignalId} —{' '}
                    {p.turnsRemaining} quarter(s) remaining
                  </li>
                ))}
              </ul>
            </>
          )}
          {standing.length > 0 && (
            <>
              <h4>Commitment register</h4>
              <ul className="plain">
                {standing.map((c) => (
                  <li key={c.id}>
                    {content.cardsById[c.cardId]?.title ?? c.cardId} · floor {c.floorResponse} ·{' '}
                    <span className={`tag tag-${c.status.toLowerCase()}`}>{c.status}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel">
          <h3>Intelligence estimates</h3>
          {latestIntel.length === 0 && <p className="muted">No new reporting this quarter.</p>}
          <ul className="plain">
            {latestIntel.map((est) => (
              <li key={`${est.metric}-${est.turn}`} className="intel-item">
                <div className="intel-head">
                  <strong>{METRIC_LABELS[est.metric] ?? est.metric}</strong>
                  <span className={`tag tag-${est.confidence.toLowerCase()}`}>
                    {est.confidence} confidence
                  </span>
                </div>
                <p className="muted">{intelBody(est, content)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel span-2">
          <h3>Inbox</h3>
          {inbox.length === 0 && <p className="muted">No correspondence this quarter.</p>}
          <ul className="plain">
            {inbox.map((msg) => {
              const staged = draft.inboxResponses?.find((r) => r.messageId === msg.id);
              return (
                <li key={msg.id} className="message">
                  <div className="intel-head">
                    <strong>{msg.subject}</strong>
                    <span className="tag">{msg.voiceId.replace(/_/g, ' ')}</span>
                  </div>
                  <p>{msg.body}</p>
                  {msg.responseOptions && (
                    <div className="options">
                      {msg.responseOptions.map((opt) => (
                        <button
                          key={opt.id}
                          className={staged?.optionId === opt.id ? 'option selected' : 'option'}
                          onClick={() => stageInboxResponse(msg.id, opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="actions">
        <button
          className="primary"
          onClick={() => setView(state.world.stagedProbeId ? 'PROBE_RESPONSE' : 'SIGNALS')}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
