import { clamp01, intelSigma } from '../engine';
import type { ContentPack, GameState, IntelEstimate } from '../engine';

const METRIC_LABELS: Record<string, string> = {
  RESOLVE_READ: 'Their read of our resolve',
  CAPABILITY_READ: 'Their read of our capability',
  INTENT_ASSESSMENT: 'Assessed hostile intent',
  ARMING_READ: 'Rival arming level',
};

// Intel is deliberately imprecise, so report it coarsely: nearest 5 points on a
// 0-100 scale rather than two decimals of false precision.
function coarse(value01: number): number {
  return Math.round((value01 * 100) / 5) * 5;
}

function intelBody(est: IntelEstimate, content: ContentPack, reading: number): string {
  const tmpl = content.intelTemplates.find((t) => t.id === est.sourceFlavorId);
  const label = METRIC_LABELS[est.metric] ?? est.metric;
  if (!tmpl) return `${label}: ${reading}/100`;
  return tmpl.body.replace('{value}', `${reading}/100`);
}

// The error band is the current intel noise sigma: the same figure the engine
// samples the estimate's noise from, so the band is the honest ±1 sigma spread.
export function IntelEstimateRow({
  est,
  state,
  content,
}: {
  est: IntelEstimate;
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const level = state.player.tracks.intelligence;
  const sigma = intelSigma(
    level,
    content.scenario.tuning.intelSigmaLevel0,
    content.scenario.tuning.intelSigmaLevel10,
  );
  const reading = coarse(est.value);
  const lo = coarse(clamp01(est.value - sigma));
  const hi = coarse(clamp01(est.value + sigma));
  const margin = Math.round(sigma * 100);

  return (
    <li className="intel-item">
      <div className="intel-head">
        <strong>{METRIC_LABELS[est.metric] ?? est.metric}</strong>
        <span className={`tag tag-${est.confidence.toLowerCase()}`}>
          {est.confidence} confidence
        </span>
      </div>

      <div className="gauge" role="img" aria-label={`Estimate ${reading} of 100, plausible range ${lo} to ${hi}`}>
        <div className="gauge-track">
          <div className="gauge-band" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
          <div className="gauge-marker" style={{ left: `${reading}%` }} />
        </div>
        <div className="gauge-scale">
          <span>0</span>
          <span className="gauge-reading">
            ~{reading} <span className="muted">({lo}&ndash;{hi})</span>
          </span>
          <span>100</span>
        </div>
      </div>

      <p className="muted">{intelBody(est, content, reading)}</p>
      <p className="intel-why">
        {est.confidence} confidence because intelligence is at {level}/10 &mdash; reporting carries
        about &plusmn;{margin} points of error. Each level of the intelligence track narrows the
        band.
      </p>
    </li>
  );
}
