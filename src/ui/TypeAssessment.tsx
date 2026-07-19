// Type Assessment — the analyst's judgement. The player commits to a hypothesis
// about the Rival's underlying nature (or declares uncertainty). This never
// reveals ground truth; the belief is logged and scored for calibration at the
// debrief. The three hypotheses are framed as competing analytic lines.

import { useGameStore } from '../store/gameStore';
import type { RivalType } from '../engine/types';
import { useRovingRadio } from './useRovingRadio';

type Belief = RivalType | 'UNSURE';

const HYPOTHESES: { id: Belief; name: string; line: string }[] = [
  {
    id: 'OPPORTUNIST',
    name: 'Opportunist',
    line: 'Probes for cheap gains and backs off when the price rises. Deterrence by credible cost should hold — firmness pays, concessions invite more.',
  },
  {
    id: 'PRESSURED_EXPANSIONIST',
    name: 'Pressured Expansionist',
    line: 'Driven by internal pressure toward a fait accompli. A hard deterrent by denial matters most, and matters early — the window closes as pressure builds.',
  },
  {
    id: 'SECURITY_SEEKER',
    name: 'Security Seeker',
    line: 'Fundamentally defensive but fearful. Offensive-coded build-ups and maximal signals may feed a spiral; reassurance can lower the temperature.',
  },
  {
    id: 'UNSURE',
    name: 'Insufficient Evidence',
    line: 'The reporting does not yet distinguish the hypotheses. Hold judgement and hedge.',
  },
];

export function TypeAssessment(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const draft = useGameStore((s) => s.draft);
  const setTypeBelief = useGameStore((s) => s.setTypeBelief);
  const goToStage = useGameStore((s) => s.goToStage);
  const hypRadio = useRovingRadio(
    HYPOTHESES.length,
    HYPOTHESES.findIndex((h) => h.id === draft.typeBelief),
    (i) => setTypeBelief(HYPOTHESES[i].id),
  );

  if (!state) return null;

  const current = draft.typeBelief;
  const history = state.analytics.typeBeliefs;

  return (
    <div className="screen assessment">
      <h2 className="screen-title">Rival Assessment</h2>
      <p className="screen-intro">
        Weigh the competing hypotheses about the Rival's true nature. Your standing judgement is logged
        each quarter you revise it and scored for calibration at debrief — the point is to reason under
        uncertainty, not to be told the answer.
      </p>

      <div className="hypotheses" role="radiogroup" aria-label="Rival hypothesis">
        {HYPOTHESES.map((h, i) => (
          <button
            key={h.id}
            type="button"
            role="radio"
            aria-checked={current === h.id}
            {...hypRadio(i)}
            className={`hypothesis ${current === h.id ? 'selected' : ''}`}
            onClick={() => setTypeBelief(h.id)}
          >
            <span className="hyp-name">{h.name}</span>
            <span className="hyp-line">{h.line}</span>
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <section className="panel">
          <h3>Assessment History</h3>
          <ul className="belief-history">
            {history.map((b, i) => (
              <li key={`${b.turn}-${i}`}>
                <span className="muted">Q{b.turn + 1}</span>
                <span>{HYPOTHESES.find((h) => h.id === b.statedType)?.name ?? b.statedType}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="screen-actions">
        <button type="button" className="ghost" onClick={() => setTypeBelief(undefined)}>
          Clear this quarter's revision
        </button>
        <button type="button" className="primary" onClick={() => goToStage('SITREP')}>
          ← Back to SITREP
        </button>
      </div>
    </div>
  );
}
