// Debrief (Phase 1) — the reveal. The Rival's true type is disclosed here for
// the first time, alongside a calibration check against your stated assessment
// and a summary of the campaign. The full counterfactual "lattice" debrief
// (perception replay, signal/salami audits, portfolio analysis) lands in Phase 2.

import { useGameStore } from '../store/gameStore';
import type { RivalType } from '../engine/types';

const TYPE_NAME: Record<RivalType, string> = {
  OPPORTUNIST: 'Opportunist',
  PRESSURED_EXPANSIONIST: 'Pressured Expansionist',
  SECURITY_SEEKER: 'Security Seeker',
};

const ENDING_TITLE: Record<string, string> = {
  DETERRENCE_HOLD: 'Deterrence Held',
  WAR: 'Deterrence Failed — War',
  CAPITULATION: 'Capitulation',
};

export function Debrief(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const backToMenu = useGameStore((s) => s.backToMenu);

  if (!state || !content) return null;

  const trueType = state.rival.type;
  const ending = state.meta.ending;
  const beliefs = state.analytics.typeBeliefs;
  const finalBelief = beliefs.length ? beliefs[beliefs.length - 1].statedType : undefined;
  const correct = finalBelief === trueType;

  const settlement =
    ending === 'WAR' && state.epilogue
      ? [...content.epilogue.settlements]
          .sort((a, b) => a.minOutcome - b.minOutcome)
          .reduce<string | undefined>(
            (acc, s) => (state.epilogue && state.epilogue.finalOutcome >= s.minOutcome ? s.text : acc),
            undefined,
          )
      : undefined;

  const probes = state.world.probeLog.length;
  const concedes = state.world.probeLog.filter((p) => p.responseType === 'CONCEDE').length;

  return (
    <div className="screen debrief">
      <h2 className="screen-title">Debrief</h2>

      <div className={`ending-banner ${ending === 'DETERRENCE_HOLD' ? 'good' : ending === 'WAR' ? 'bad' : 'warn'}`}>
        <h3>{ending ? ENDING_TITLE[ending] : 'Campaign Ended'}</h3>
        {settlement && <p>{settlement}</p>}
      </div>

      <section className="panel reveal">
        <h3>The Rival's True Nature</h3>
        <p className="reveal-type">{TYPE_NAME[trueType]}</p>
        <p>{content.diagnosis.tellSheets[trueType]}</p>
        <div className={`calibration ${correct ? 'good' : 'warn'}`}>
          {finalBelief
            ? correct
              ? 'Your final assessment was correct.'
              : `Your final assessment (${finalBelief === 'UNSURE' ? 'Unsure' : TYPE_NAME[finalBelief]}) did not match.`
            : 'You never committed to an assessment.'}
        </div>
      </section>

      <section className="panel">
        <h3>Campaign Summary</h3>
        <ul className="summary-grid">
          <li><span>Quarters played</span><strong>{state.meta.turnNumber}</strong></li>
          <li><span>Probes faced</span><strong>{probes}</strong></li>
          <li><span>Concessions</span><strong>{concedes}</strong></li>
          <li><span>Commitments honored</span><strong>{state.player.honoredTestCount}</strong></li>
          <li><span>Back-downs</span><strong>{state.player.backDownCount}</strong></li>
          <li><span>Final status quo</span><strong>{Math.round(state.world.statusQuoIntegrity)}</strong></li>
        </ul>
      </section>

      <p className="footnote">
        The full counterfactual debrief — perception replay, signal and salami audits, and the strategy
        lattice showing how other approaches would have fared against this Rival — arrives in the next
        release.
      </p>

      <div className="screen-actions">
        <button type="button" className="primary" onClick={backToMenu}>
          Return to Menu
        </button>
      </div>
    </div>
  );
}
