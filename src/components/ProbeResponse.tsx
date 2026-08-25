import type { ContentPack, GameState } from '../engine';
import { useGameStore } from '../store/gameStore';
import { Hud } from './Hud';
import { PROBE_CHARTS } from './probeCharts';

export function ProbeResponse({
  state,
  content,
}: {
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const setView = useGameStore((s) => s.setView);
  const draft = useGameStore((s) => s.draft);
  const stageProbeResponse = useGameStore((s) => s.stageProbeResponse);

  const probe = content.probes.find((p) => p.id === state.world.stagedProbeId);
  const chart = probe ? PROBE_CHARTS[probe.id] : undefined;
  const staged = draft.probeResponse;
  const selected = probe?.responses.find((r) => r.responseType === staged?.responseType);
  const rationales = selected
    ? content.rationales.find((r) => r.id === selected.rationaleSetId)
    : undefined;

  if (!probe) {
    return (
      <div className="screen">
        <Hud state={state} content={content} />
        <h2 className="phase-heading">No provocation this quarter</h2>
        <div className="actions">
          <button className="primary" onClick={() => setView('SIGNALS')}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Hud state={state} content={content} />
      <h2 className="phase-heading">Probe response</h2>
      <section className="panel">
        <div className="intel-head">
          <h3>{probe.title}</h3>
          <span className="tag">severity {probe.severity}</span>
        </div>
        {chart && (
          <figure className="theatre-map">
            <img src={chart.src} alt={chart.alt} />
            <figcaption>
              {chart.figure} &mdash; {probe.title}, quarter{' '}
              {Math.min(state.meta.turnNumber + 1, content.scenario.turnCount)}. Positions as
              reported; sourcing unconfirmed.
            </figcaption>
          </figure>
        )}
        <p>{probe.text}</p>
        <p className="muted">
          Tags: {probe.tags.join(', ')} · conceding shifts the baseline by {probe.salamiValue}
        </p>
        <div className="ladder">
          {probe.responses.map((opt) => (
            <button
              key={opt.id}
              className={
                staged?.responseType === opt.responseType ? 'option selected' : 'option'
              }
              onClick={() => {
                const set = content.rationales.find((r) => r.id === opt.rationaleSetId);
                stageProbeResponse(
                  probe.id,
                  opt.responseType,
                  staged?.rationaleId && set?.options.some((o) => o.id === staged.rationaleId)
                    ? staged.rationaleId
                    : set?.options[0]?.id ?? 'unspecified',
                );
              }}
            >
              <span className="option-type">{opt.responseType}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && rationales && (
        <section className="panel">
          <h3>Rationale of record</h3>
          <div className="options">
            {rationales.options.map((o) => (
              <button
                key={o.id}
                className={staged?.rationaleId === o.id ? 'option selected' : 'option'}
                onClick={() => stageProbeResponse(probe.id, selected.responseType, o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <button className="ghost" onClick={() => setView('SITREP')}>
          Back
        </button>
        <button className="primary" disabled={!staged} onClick={() => setView('SIGNALS')}>
          Continue
        </button>
      </div>
    </div>
  );
}
