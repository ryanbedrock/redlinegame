// Inbox — correspondence from your cabinet and the Rival's public voices. Some
// messages carry response options whose effects apply at turn resolution; most
// are colour and perspective. Responses are staged into the draft.

import { useGameStore } from '../store/gameStore';
import type { IntelMetric } from '../engine/types';
import { VOICE_LABEL, pct } from './format';

const INTEL_METRIC_LABEL: Record<IntelMetric, string> = {
  RESOLVE_READ: 'Assessed Rival Resolve',
  CAPABILITY_READ: 'Assessed Rival Capability',
  INTENT_ASSESSMENT: 'Assessed Hostile Intent',
  ARMING_READ: 'Observed Rival Arming',
};

export function Inbox(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const draft = useGameStore((s) => s.draft);
  const setInboxResponse = useGameStore((s) => s.setInboxResponse);
  const goToStage = useGameStore((s) => s.goToStage);

  if (!state) return null;
  const messages = [...state.world.inbox].sort((a, b) => b.turn - a.turn);

  return (
    <div className="screen inbox">
      <h2 className="screen-title">Inbox</h2>
      {messages.length === 0 ? (
        <p className="muted">No correspondence yet.</p>
      ) : (
        <ul className="mail-list">
          {messages.map((m) => {
            const staged = draft.inboxResponses.find((r) => r.messageId === m.id)?.optionId;
            const answered = m.respondedWith ?? staged;
            return (
              <li key={m.id} className="mail">
                <div className="mail-head">
                  <span className="mail-voice">{VOICE_LABEL[m.voiceId] ?? m.voiceId}</span>
                  <span className="mail-quarter">Q{m.turn + 1}</span>
                </div>
                <h3 className="mail-subject">{m.subject}</h3>
                <p className="mail-body">{m.body}</p>
                {m.voiceId === 'INTEL_DIRECTOR' && (() => {
                  const est = state.world.intel.filter((i) => i.turn === m.turn);
                  if (est.length === 0) return null;
                  return (
                    <ul className="mail-estimates">
                      {est.map((i) => (
                        <li key={i.metric}>
                          <span className="me-label">{INTEL_METRIC_LABEL[i.metric]}</span>
                          <span className="me-value">{pct(i.value)}</span>
                          <span className={`confidence c-${i.confidence.toLowerCase()}`}>{i.confidence}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                {m.responseOptions && m.responseOptions.length > 0 && (
                  <div className="mail-options" role="group" aria-label="Response">
                    {m.respondedWith ? (
                      <p className="muted">
                        Responded: {m.responseOptions.find((o) => o.id === m.respondedWith)?.label}
                      </p>
                    ) : (
                      m.responseOptions.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`chip ${answered === o.id ? 'selected' : ''}`}
                          aria-pressed={answered === o.id}
                          onClick={() => setInboxResponse(m.id, o.id)}
                        >
                          {o.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="screen-actions">
        <button type="button" className="primary" onClick={() => goToStage('SITREP')}>
          ← Back to SITREP
        </button>
      </div>
    </div>
  );
}
