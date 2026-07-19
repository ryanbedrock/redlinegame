// Probe Response — the escalation-ladder decision. Each rung trades status-quo
// integrity against perceived resolve and threat perception; the engine resolves
// the consequences (and commitment tests) at turn resolution.

import { useGameStore } from '../store/gameStore';
import type { ProbeResponseOption, ResponseType } from '../engine/types';
import { RESPONSE_ORDINAL } from '../engine/types';
import { stagedProbeStakes } from '../engine/resolver';
import { RationalePicker } from './RationalePicker';
import { probeView, GLOSSARY } from './format';
import { InfoTip } from './InfoTip';
import { useRovingRadio } from './useRovingRadio';

const LADDER_HINT: Record<ResponseType, string> = {
  CONCEDE: 'Yield ground. Preserves capital now, but erodes the status quo and reads as weakness.',
  PROTEST: 'Object without acting. Low cost, low credibility.',
  MATCH: 'Meet the provocation in kind. Holds the line proportionally.',
  ENFORCE: 'Impose a real cost on the Rival. Firm, escalatory, credibility-building.',
  ESCALATE: 'Raise the stakes sharply. Maximal resolve signal — and maximal risk.',
};

function ResponseLadder({
  options,
  chosenType,
  onSelect,
}: {
  options: ProbeResponseOption[];
  chosenType: ResponseType | undefined;
  onSelect: (o: ProbeResponseOption) => void;
}): JSX.Element {
  const selectedIndex = options.findIndex((o) => o.responseType === chosenType);
  const getProps = useRovingRadio(options.length, selectedIndex, (i) => onSelect(options[i]));
  return (
    <div className="ladder" role="radiogroup" aria-label="Response">
      {options.map((o, i) => {
        const active = chosenType === o.responseType;
        const roving = getProps(i);
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            ref={roving.ref}
            tabIndex={roving.tabIndex}
            onKeyDown={roving.onKeyDown}
            className={`ladder-rung rung-${RESPONSE_ORDINAL[o.responseType]} ${active ? 'selected' : ''}`}
            onClick={() => onSelect(o)}
          >
            <span className="rung-type">{o.responseType}</span>
            <span className="rung-label">{o.label}</span>
            <span className="rung-hint">{LADDER_HINT[o.responseType]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ProbeResponse(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const draft = useGameStore((s) => s.draft);
  const setProbeResponse = useGameStore((s) => s.setProbeResponse);
  const goToStage = useGameStore((s) => s.goToStage);

  if (!state || !content) return null;
  const stakes = stagedProbeStakes(state, content);
  const probe = stakes?.probe;

  if (!probe || !stakes) {
    return (
      <div className="screen">
        <p className="muted">No probe to respond to.</p>
        <div className="screen-actions">
          <button type="button" className="primary" onClick={() => goToStage('SIGNALS')}>
            Continue →
          </button>
        </div>
      </div>
    );
  }

  const chosen = draft.probeResponse;
  const view = probeView(probe, state.world.stagedProbeVariant);
  const options = [...probe.responses].sort(
    (a, b) => RESPONSE_ORDINAL[a.responseType] - RESPONSE_ORDINAL[b.responseType],
  );

  return (
    <div className="screen probe-response">
      <h2 className="screen-title">
        Probe Response
        <InfoTip term="the response ladder" label={GLOSSARY.responseLadder} side="bottom" />
      </h2>
      <section className="panel probe-card">
        <div className="probe-preview-head">
          <span className="probe-title">{view.title}</span>
          <span className={`severity${stakes.escalated ? ' escalated' : ''}`}>
            Severity {stakes.severity}
            {stakes.escalated && ' (escalated)'}
          </span>
        </div>
        <p>{view.text}</p>
        {probe.intent && <p className="probe-intent">Intelligence read: {probe.intent}</p>}
        {stakes.escalated && (
          <p className="alert warn" role="alert">
            Escalated stakes: your concession streak has pushed the Rival to press harder, so this
            probe lands at higher severity. Conceding now cedes ~{Math.round(stakes.salamiValue)}{' '}
            status-quo integrity (vs {Math.round(probe.salamiValue)} normally).
          </p>
        )}
        <p className="footnote">Tags: {probe.tags.join(', ')}</p>
      </section>

      <ResponseLadder
        options={options}
        chosenType={chosen?.responseType}
        onSelect={(o) =>
          setProbeResponse(
            o.responseType,
            o.rationaleSetId
              ? content.rationales.find((r) => r.id === o.rationaleSetId)?.options[0]?.id ?? 'auto'
              : 'auto',
          )
        }
      />

      {chosen && (
        <div className="panel rationale-panel">
          <RationalePicker
            id="probe-rationale"
            set={content.rationales.find(
              (r) => r.id === options.find((o) => o.responseType === chosen.responseType)?.rationaleSetId,
            )}
            value={chosen.rationaleId}
            onChange={(rid) => setProbeResponse(chosen.responseType, rid)}
          />
        </div>
      )}

      <div className="screen-actions">
        <button type="button" className="ghost" onClick={() => goToStage('SITREP')}>
          ← Back
        </button>
        <button type="button" className="primary" disabled={!chosen} onClick={() => goToStage('SIGNALS')}>
          Continue to Orders →
        </button>
      </div>
    </div>
  );
}
