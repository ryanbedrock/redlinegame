// Debrief (Phase 2) — the counterfactual "lattice" after-action review. Reveals
// the Rival's true type for the first time and, alongside it, the hidden
// perception ledgers, a signal/salami audit, the diagnosis trajectory, and the
// strategy lattice: how authored alternative doctrines and other Rival types
// would have fared against the same seed (PRD §6.12/§6.13).

import { useGameStore } from '../store/gameStore';
import type { RivalType, SignalClass } from '../engine/types';
import { useDebrief } from './useDebrief';
import { PerceptionReplay, StrategyLattice, type LatticeRowData } from './charts';
import { signed } from './format';

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

const SIGNAL_LABEL: Record<SignalClass, string> = {
  CHEAP: 'Cheap talk',
  SUNK: 'Sunk cost',
  TIED_HANDS: 'Tied hands',
  REASSURANCE: 'Reassurance',
};

function typeName(t: RivalType | 'UNSURE'): string {
  return t === 'UNSURE' ? 'Unsure' : TYPE_NAME[t];
}

function endingLabel(e: string | null): string {
  return e ? (ENDING_TITLE[e] ?? e) : 'In progress';
}

function ScoreBar({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="score-pillar">
      <div className="score-pillar-head">
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <div className="score-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function Debrief(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const save = useGameStore((s) => s.save);
  const backToMenu = useGameStore((s) => s.backToMenu);
  const goToStage = useGameStore((s) => s.goToStage);

  const data = useDebrief(state, content, save);
  if (!state || !content || !save || !data) return null;

  const { report, score, belief, salami, signals } = data;
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

  // War epilogue: which choices were taken and whether termination leverage
  // (a punishment-track settlement bonus) was actually available.
  const epilogueChoices =
    ending === 'WAR' && state.epilogue
      ? state.epilogue.decisionsTaken.map((tag) => {
          const [decisionId, optionId] = tag.split(':');
          const decision = content.epilogue.decisions.find((d) => d.id === decisionId);
          const option = decision?.options.find((o) => o.id === optionId);
          return {
            title: decision?.title ?? decisionId,
            label: option?.label ?? optionId,
            leverage: Boolean(option?.terminationLeverage),
          };
        })
      : [];
  const leverageAvailable = state.player.tracks.punishment > 3;

  // Strategy lattice rows: your campaign, then authored policies, then type-swaps.
  const latticeRows: LatticeRowData[] = [
    { label: 'Your campaign', sublabel: endingLabel(ending), lattice: report.actual.lattice, emphasis: true },
    ...report.policies.map((p) => ({
      label: p.profile.name,
      sublabel: endingLabel(p.run.ending),
      lattice: p.run.lattice,
    })),
    ...report.typeSwaps.map((ts) => ({
      label: `Your play vs a ${TYPE_NAME[ts.type]}`,
      sublabel: endingLabel(ts.run.ending),
      lattice: ts.run.lattice,
    })),
  ];

  return (
    <main className="screen debrief">
      <h2 className="screen-title">After-Action Debrief</h2>

      <div className={`ending-banner ${ending === 'DETERRENCE_HOLD' ? 'good' : ending === 'WAR' ? 'bad' : 'warn'}`}>
        <h3>{endingLabel(ending)}</h3>
        {settlement && <p>{settlement}</p>}
      </div>

      {/* 1 — Score */}
      <section className="panel">
        <h3>Assessment</h3>
        <div className="score-headline">
          <div className="composite">
            <span className="composite-value">{Math.round(score.composite)}</span>
            <span className="composite-band">{score.band}</span>
          </div>
          <p className="composite-note">
            Weighted across outcome, robustness to who the Rival turned out to be, diagnosis, credibility
            discipline, and efficiency of spend.
          </p>
        </div>
        <div className="score-pillars">
          <ScoreBar label="Outcome" value={score.outcome} />
          <ScoreBar label="Robustness" value={score.robustness} />
          <ScoreBar label="Diagnosis" value={score.diagnosis} />
          <ScoreBar label="Credibility" value={score.credibility} />
          <ScoreBar label="Efficiency" value={score.efficiency} />
        </div>
      </section>

      {/* 2 — Reveal */}
      <section className="panel reveal">
        <h3>The Rival's True Nature</h3>
        <p className="reveal-type">{TYPE_NAME[trueType]}</p>
        <p>{content.diagnosis.tellSheets[trueType]}</p>
        <div className={`calibration ${correct ? 'good' : 'warn'}`}>
          {finalBelief
            ? correct
              ? 'Your final assessment was correct.'
              : `Your final assessment (${typeName(finalBelief)}) did not match.`
            : 'You never committed to an assessment.'}
        </div>
      </section>

      {/* War epilogue — termination leverage */}
      {ending === 'WAR' && state.epilogue && (
        <section className="panel">
          <h3>The War &amp; Its Termination</h3>
          <p className="panel-note">
            Deterrence failed, so the war was fought and ended. Denial and readiness decided the
            battlefield; punishment reach mattered only at the table — and only if you had built it.
            Termination leverage (a favorable-settlement bonus) is available once your punishment track
            exceeds level 3: {leverageAvailable ? 'you had it.' : 'you did not have it.'}
          </p>
          <ul className="epilogue-choices">
            {epilogueChoices.map((c, i) => (
              <li key={i}>
                <span className="ec-title">{c.title}</span>
                <span className="ec-label">{c.label}</span>
                {c.leverage && (
                  <span className={`ec-tag ${leverageAvailable ? 'good' : 'faint'}`}>
                    {leverageAvailable ? 'leverage applied' : 'leverage sought — none built'}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="delta-grid" style={{ marginTop: '0.9rem' }}>
            <div className="delta"><span>Opening war position</span><strong>{Math.round(state.epilogue.warOutcomeBase)}</strong></div>
            <div className="delta"><span>Final settlement</span><strong>{Math.round(state.epilogue.finalOutcome)}</strong></div>
          </div>
        </section>
      )}

      {/* 3 — Perception replay */}
      <section className="panel">
        <h3>Perception Replay</h3>
        <p className="panel-note">
          What the Rival actually thought — hidden during play. Threat perception and war-utility are what
          you were steering blind; resolve and capability are how the Rival read you.
        </p>
        <PerceptionReplay history={state.analytics.perceptionHistory} />
      </section>

      {/* 4 — Strategy lattice */}
      <section className="panel">
        <h3>Strategy Lattice</h3>
        <p className="panel-note">
          Against this exact Rival and seed: how your campaign unfolded quarter-by-quarter, how four
          authored doctrines would have fared, and how your own play would have gone had the Rival been a
          different type. Robustness across those types: <strong>{Math.round(report.robustness01 * 100)}</strong>/100
          &nbsp;({report.reSimCount} deterministic re-simulations).
        </p>
        <StrategyLattice rows={latticeRows} />
      </section>

      {/* 4b — Pivot analysis (sub-seeded counterfactuals) */}
      {report.pivots.length > 0 && (
        <section className="panel">
          <h3>Pivot Analysis</h3>
          <p className="panel-note">
            At each quarter where the Rival&apos;s war calculus swung most, we replay the campaign with
            your response flipped, then re-run it under {content.scenario.tuning.pivotSubSeeds} draws of
            the exogenous uncertainty (when external shocks land, which variant of a probe appears).
            &ldquo;Agreement&rdquo; is how consistently that alternative leads to the same ending — high
            agreement means the outcome was robust to luck; low means the quarter was a genuine coin-flip.
          </p>
          <table className="audit">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Your call → alternative</th>
                <th>Most likely result</th>
                <th>Agreement</th>
                <th>Across draws</th>
              </tr>
            </thead>
            <tbody>
              {report.pivots.map((p) => {
                const tally = new Map<string, number>();
                for (const r of p.subRuns) {
                  const key = endingLabel(r.ending);
                  tally.set(key, (tally.get(key) ?? 0) + 1);
                }
                const spread = [...tally.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, n]) => `${n}× ${label}`)
                  .join(', ');
                return (
                  <tr key={p.pivot.pivotId}>
                    <td>Q{p.pivot.turn + 1}</td>
                    <td>
                      {p.recordedResponse} → <strong>{p.altResponse}</strong>
                    </td>
                    <td>{endingLabel(p.modalEnding)}</td>
                    <td>{Math.round(p.agreement * 100)}%</td>
                    <td className="muted">{spread}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* 5 — Diagnosis trajectory */}
      <section className="panel">
        <h3>Diagnosis</h3>
        <ul className="summary-grid">
          <li><span>First correct read</span><strong>{belief.turnsToFirstCorrect === null ? 'Never' : `Q${belief.turnsToFirstCorrect + 1}`}</strong></li>
          <li><span>Belief at commitment lock-in</span><strong>{belief.beliefAtLockIn ? typeName(belief.beliefAtLockIn) : '—'}</strong></li>
          <li><span>Assessment changes</span><strong>{belief.flipFlops}</strong></li>
          <li><span>Diagnosis quality</span><strong>{Math.round(belief.score * 100)}</strong></li>
        </ul>
      </section>

      {/* 6 — Signal audit */}
      <section className="panel">
        <h3>Signal Audit</h3>
        {signals.length === 0 ? (
          <p className="empty">You sent no signals.</p>
        ) : (
          <table className="audit">
            <thead>
              <tr><th>Q</th><th>Signal</th><th>Class</th><th>Cost</th><th>Resolve read Δ</th></tr>
            </thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={i}>
                  <td>{s.turn + 1}</td>
                  <td>{content.cardsById[s.cardId]?.title ?? s.cardId}</td>
                  <td>{SIGNAL_LABEL[s.type]}</td>
                  <td>{s.budget}B{s.politicalCapital ? ` ${s.politicalCapital}PC` : ''}</td>
                  <td className={s.resolveDelta > 0 ? 'good' : s.resolveDelta < 0 ? 'bad' : ''}>{signed(s.resolveDelta, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 7 — Salami audit */}
      <section className="panel">
        <h3>Salami Audit</h3>
        {salami.length === 0 ? (
          <p className="empty">The Rival never probed the line.</p>
        ) : (
          <table className="audit">
            <thead>
              <tr><th>Q</th><th>Probe</th><th>Response</th><th>Status-quo Δ</th><th>Remaining</th></tr>
            </thead>
            <tbody>
              {salami.map((s, i) => (
                <tr key={i}>
                  <td>{s.turn + 1}</td>
                  <td>{s.probeId}</td>
                  <td>{s.responseType}</td>
                  <td className={s.delta < 0 ? 'bad' : ''}>{signed(s.delta)}</td>
                  <td>{Math.round(s.cumulativeIntegrity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="screen-actions">
        <button type="button" className="primary" onClick={() => goToStage('KNOWLEDGE')}>
          Knowledge Check →
        </button>
        <button type="button" className="ghost" onClick={backToMenu}>
          Return to Menu
        </button>
      </div>
    </main>
  );
}
