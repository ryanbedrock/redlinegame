// SITREP — the quarter's opening brief. Shows only player-visible intelligence
// (noisy estimates, never the true ledgers), the incoming probe, standing
// commitments, and in-flight build pipelines.

import { useGameStore } from '../store/gameStore';
import type { IntelMetric } from '../engine/types';
import { pct, probeView, GLOSSARY } from './format';
import { InfoTip } from './InfoTip';

const METRIC_LABEL: Record<IntelMetric, string> = {
  RESOLVE_READ: 'Assessed Rival Resolve',
  CAPABILITY_READ: 'Assessed Rival Capability',
  INTENT_ASSESSMENT: 'Assessed Hostile Intent',
  ARMING_READ: 'Observed Rival Arming',
};

export function Sitrep(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const goToStage = useGameStore((s) => s.goToStage);

  if (!state || !content) return null;

  const turn = state.meta.turnNumber;
  const intelThisTurn = state.world.intel.filter((i) => i.turn === turn);
  const staged = state.world.stagedProbeId
    ? content.probes.find((p) => p.id === state.world.stagedProbeId)
    : undefined;
  const salamiThreshold = content.scenario.tuning.concessionSalamiThreshold;
  const concedeStreak = state.world.concessionStreak;

  const templateBody = (metric: IntelMetric, flavorId: string, value: number): string => {
    const t = content.intelTemplates.find((x) => x.id === flavorId);
    if (!t) return METRIC_LABEL[metric];
    return t.body.replace('{value}', pct(value));
  };

  return (
    <div className="screen sitrep">
      <h2 className="screen-title">Situation Report</h2>

      {concedeStreak >= salamiThreshold && (
        <div className="alert warn" role="alert">
          Salami warning: {concedeStreak} consecutive concessions. The Rival is escalating the tempo and
          severity of its probes — repeated backing-down invites a fait accompli.
        </div>
      )}

      <section className="panel" data-tour="intel">
        <h3>
          Intelligence Estimates
          <InfoTip term="Intelligence Estimates" label={GLOSSARY.intelEstimates} side="bottom" />
        </h3>
        <p className="panel-note">
          This is your intelligence: each read is the Rival's own (imperfect) estimate of you, or
          your estimate of it. The Inbox brief repeats these same numbers — reading it is optional.
        </p>
        {intelThisTurn.length === 0 ? (
          <p className="muted">No fresh reporting this quarter.</p>
        ) : (
          <ul className="intel-list">
            {intelThisTurn.map((i) => (
              <li key={`${i.metric}-${i.turn}`} className="intel-row">
                <div className="intel-head">
                  <span className="intel-metric">{METRIC_LABEL[i.metric]}</span>
                  <span className={`confidence c-${i.confidence.toLowerCase()}`}>{i.confidence}</span>
                </div>
                <div className="intel-bar">
                  <div className="intel-fill" style={{ width: pct(i.value) }} />
                </div>
                <p className="intel-body">{templateBody(i.metric, i.sourceFlavorId, i.value)}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="footnote">
          Estimates carry error — collection is imperfect and the Rival may be shaping what you see.
          Investing in Intelligence tightens these reads.
        </p>
      </section>

      <section className="panel incoming" data-tour="incoming">
        <h3>
          Incoming
          <InfoTip term="the incoming probe" label={GLOSSARY.probe} side="bottom" />
        </h3>
        {staged ? (
          <div className="probe-preview">
            <div className="probe-preview-head">
              <span className="probe-title">{probeView(staged, state.world.stagedProbeVariant).title}</span>
              <span className="severity">Severity {staged.severity}</span>
            </div>
            <p>{probeView(staged, state.world.stagedProbeVariant).text}</p>
            {staged.intent && <p className="probe-intent">Intelligence read: {staged.intent}</p>}
            <button type="button" className="primary" onClick={() => goToStage('PROBE')}>
              Formulate Response →
            </button>
          </div>
        ) : (
          <p className="muted">No active provocation this quarter. Proceed to orders.</p>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <h3>Standing Commitments</h3>
          {state.player.commitmentRegister.length === 0 ? (
            <p className="muted">None declared.</p>
          ) : (
            <ul className="commitment-list">
              {state.player.commitmentRegister.map((c) => (
                <li key={c.id}>
                  <span className={`status s-${c.status.toLowerCase()}`}>{c.status}</span>
                  <span>{content.cardsById[c.cardId]?.title ?? c.cardId}</span>
                  <span className="muted">
                    floor {c.floorResponse} · tested {c.timesTested}× · honored {c.timesHonored}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h3>Build Pipeline</h3>
          {state.player.pendingInvestments.length === 0 ? (
            <p className="muted">No builds in progress.</p>
          ) : (
            <ul className="pipeline-list">
              {state.player.pendingInvestments.map((inv) => (
                <li key={inv.trackOrSignalId}>
                  <span>{content.cardsById[inv.trackOrSignalId]?.title ?? inv.trackOrSignalId}</span>
                  <span className="muted">
                    {inv.turnsRemaining} quarter{inv.turnsRemaining === 1 ? '' : 's'} remaining
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="screen-actions">
        {staged ? (
          <button type="button" className="primary" onClick={() => goToStage('PROBE')}>
            Respond to Probe →
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => goToStage('SIGNALS')}>
            Issue Orders →
          </button>
        )}
      </div>
    </div>
  );
}
