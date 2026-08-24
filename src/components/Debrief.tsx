import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  coherenceAudit,
  commitmentLedger,
  commitmentSummary,
  computeScore,
  outcomeBand,
  runCounterfactualReport,
  salamiAudit,
  signalAudit,
  type ContentPack,
  type GameState,
  type OutcomeState,
} from '../engine';
import { useGameStore } from '../store/gameStore';

const LATTICE_CLASS: Record<OutcomeState, string> = {
  PEACE: 'lattice-peace',
  CRISIS: 'lattice-crisis',
  WAR: 'lattice-war',
  CAPITULATION: 'lattice-capitulation',
};

export function Debrief({
  state,
  content,
}: {
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const committed = useGameStore((s) => s.committed);
  const reset = useGameStore((s) => s.reset);

  const report = useMemo(
    () => runCounterfactualReport(content, state.meta.seed, committed, state.rival.type),
    [content, state.meta.seed, committed, state.rival.type],
  );
  const band = outcomeBand(state, content);
  const score = computeScore(state, content, report.robustness01);
  const salami = salamiAudit(state);
  const signals = signalAudit(state);
  const coherence = coherenceAudit(state, content);
  const ledger = commitmentLedger(state, content);
  const settlement = [...content.epilogue.settlements]
    .sort((a, b) => b.minOutcome - a.minOutcome)
    .find((s) => band.value >= s.minOutcome);

  const perceptionData = state.analytics.perceptionHistory.map((p) => ({
    turn: p.turn + 1,
    warUtility: Number(p.warUtility.toFixed(3)),
    threatPerception: Number(p.threatPerception.toFixed(3)),
    perceivedResolve: Number(p.perceivedResolve.toFixed(3)),
  }));

  const counterfactualData = [
    { name: 'Your play', outcome: Number(report.actual.outcome.toFixed(1)) },
    ...report.policies.map((p) => ({
      name: p.profile.name,
      outcome: Number(p.run.outcome.toFixed(1)),
    })),
    ...report.typeSwaps.map((t) => ({
      name: `If ${t.type.replace(/_/g, ' ').toLowerCase()}`,
      outcome: Number(t.run.outcome.toFixed(1)),
    })),
  ];

  return (
    <div className="screen">
      <header className="hud">
        <div className="hud-title">
          <h1>Debrief</h1>
          <p className="subtitle">
            {content.scenario.name} · ending {state.meta.ending?.replace(/_/g, ' ') ?? 'unresolved'}
          </p>
        </div>
        <button className="ghost" onClick={reset}>
          New game
        </button>
      </header>

      <div className="grid">
        <section className="panel">
          <h3>Outcome</h3>
          <p className="big">{band.label}</p>
          <table className="table">
            <tbody>
              <tr>
                <td>Outcome value</td>
                <td className="num">{band.value.toFixed(1)}</td>
              </tr>
              <tr>
                <td>Band points</td>
                <td className="num">{band.points}</td>
              </tr>
              <tr>
                <td>Status-quo integrity</td>
                <td className="num">{state.world.statusQuoIntegrity.toFixed(0)}</td>
              </tr>
              <tr>
                <td>Quarters survived</td>
                <td className="num">{state.analytics.turnRecords.length}</td>
              </tr>
            </tbody>
          </table>
          {settlement && <p className="muted">{settlement.text}</p>}
        </section>

        <section className="panel">
          <h3>Composite score</h3>
          <p className="big">
            {score.composite.toFixed(1)}
            <span className="muted"> / 100</span>
          </p>
          <table className="table">
            <tbody>
              <tr>
                <td>Outcome</td>
                <td className="num">{score.outcome.toFixed(1)}</td>
              </tr>
              <tr>
                <td>Robustness</td>
                <td className="num">{score.robustness.toFixed(1)}</td>
              </tr>
              <tr>
                <td>Diagnosis</td>
                <td className="num">{score.diagnosis.toFixed(1)}</td>
              </tr>
              <tr>
                <td>Credibility</td>
                <td className="num">{score.credibility.toFixed(1)}</td>
              </tr>
              <tr className="sub">
                <td>&nbsp;&nbsp;Commitment discipline</td>
                <td className="num">{score.discipline.toFixed(1)}</td>
              </tr>
              <tr className="sub">
                <td>&nbsp;&nbsp;Rationale coherence</td>
                <td className="num">
                  {score.coherence === null ? 'n/a' : score.coherence.toFixed(1)}
                </td>
              </tr>
              <tr>
                <td>Efficiency</td>
                <td className="num">{score.efficiency.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="panel span-2">
          <h3>The Rival revealed</h3>
          <p className="big">{state.rival.type.replace(/_/g, ' ')}</p>
          <p className="muted">{content.diagnosis.typeDescriptions[state.rival.type]}</p>
          <p>{content.diagnosis.tellSheets[state.rival.type]}</p>
        </section>

        <section className="panel span-2">
          <h3>Perception over time</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={perceptionData}>
                <CartesianGrid stroke="#233042" />
                <XAxis dataKey="turn" stroke="#9aa7b4" />
                <YAxis stroke="#9aa7b4" domain={[0, 1]} />
                <Tooltip
                  contentStyle={{ background: '#131a22', border: '1px solid #233042' }}
                  labelStyle={{ color: '#e6edf3' }}
                />
                <Legend />
                <Line type="monotone" dataKey="warUtility" stroke="#c0392b" dot={false} />
                <Line type="monotone" dataKey="threatPerception" stroke="#e0a458" dot={false} />
                <Line type="monotone" dataKey="perceivedResolve" stroke="#5aa9e6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel span-2">
          <h3>Counterfactual outcomes</h3>
          <p className="muted">
            {report.reSimCount} re-simulations against the same seed. Robustness{' '}
            {(report.robustness01 * 100).toFixed(1)} / 100.
          </p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={counterfactualData}>
                <CartesianGrid stroke="#233042" />
                <XAxis dataKey="name" stroke="#9aa7b4" interval={0} height={60} angle={-20} dy={16} />
                <YAxis stroke="#9aa7b4" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#131a22', border: '1px solid #233042' }}
                  labelStyle={{ color: '#e6edf3' }}
                />
                <Bar dataKey="outcome" fill="#c0392b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel span-2">
          <h3>Pivot lattice</h3>
          <p className="muted">
            Each row re-runs the quarter with the opposite response across sub-seeds; cells show the
            modal trajectory (peace, crisis, war, capitulation).
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Pivot</th>
                <th>Swing</th>
                <th>Modal ending</th>
                <th>Agreement</th>
                <th>Trajectory</th>
              </tr>
            </thead>
            <tbody>
              {report.pivots.map((row) => (
                <tr key={row.pivot.pivotId}>
                  <td>Quarter {row.pivot.turn + 1}</td>
                  <td className="num">{row.pivot.swing.toFixed(3)}</td>
                  <td>{row.modalEnding?.replace(/_/g, ' ') ?? 'ongoing'}</td>
                  <td className="num">{(row.agreement * 100).toFixed(0)}%</td>
                  <td>
                    <div className="lattice">
                      {row.lattice.map((cell, i) => (
                        <span
                          key={i}
                          className={`lattice-cell ${LATTICE_CLASS[cell]}`}
                          title={`Q${i + 1}: ${cell}`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel span-2">
          <h3>Salami audit</h3>
          {salami.length === 0 ? (
            <p className="muted">No probes were logged.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Probe</th>
                  <th>Response</th>
                  <th>Δ integrity</th>
                  <th>Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {salami.map((step, i) => (
                  <tr key={`${step.turn}-${step.probeId}-${i}`}>
                    <td>{step.turn + 1}</td>
                    <td>{content.probes.find((p) => p.id === step.probeId)?.title ?? step.probeId}</td>
                    <td>{step.responseType}</td>
                    <td className="num">{step.delta.toFixed(1)}</td>
                    <td className="num">{step.cumulativeIntegrity.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel span-2">
          <h3>Commitment ledger</h3>
          <p className="muted">
            Every commitment you declared, and how each in-scope provocation tested it. Meeting the
            floor honors it and pays political capital; falling below breaks it permanently.
          </p>
          {ledger.length === 0 ? (
            <p className="muted">You never tied your hands, so nothing could be honored or broken.</p>
          ) : (
            ledger.map((entry) => (
              <div key={entry.commitment.id} className="commitment">
                <div className="intel-head">
                  <strong>{entry.title}</strong>
                  <span className={`tag tag-${entry.status.toLowerCase()}`}>{entry.status}</span>
                </div>
                <p className="muted">{commitmentSummary(entry)}</p>
                {entry.tests.length > 0 && (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Quarter</th>
                        <th>Provocation</th>
                        <th>Floor</th>
                        <th>Your response</th>
                        <th>Verdict</th>
                        <th>PC change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.tests.map((t, i) => (
                        <tr key={`${t.turn}-${t.probeId}-${i}`}>
                          <td>{t.turn + 1}</td>
                          <td>{t.probeTitle}</td>
                          <td>{entry.floorResponse}</td>
                          <td>{t.responseType}</td>
                          <td>
                            <span className={`tag tag-${t.honored ? 'honored' : 'broken'}`}>
                              {t.honored ? 'HONORED' : 'BROKEN'}
                            </span>
                          </td>
                          <td className="num">
                            {t.pcDelta > 0 ? `+${t.pcDelta}` : t.pcDelta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </section>

        <section className="panel span-2">
          <h3>Rationale audit</h3>
          <p className="muted">
            What you said you were doing, against what you did.{' '}
            {coherence.scored > 0 && (
              <>
                {coherence.mismatches} of {coherence.scored} justified decisions contradicted their
                stated reason.
              </>
            )}
          </p>
          {coherence.rows.length === 0 ? (
            <p className="muted">No justified decisions were logged.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Decision</th>
                  <th>Stated reason</th>
                  <th>Verdict</th>
                  <th>Reading</th>
                </tr>
              </thead>
              <tbody>
                {coherence.rows.map((row, i) => (
                  <tr key={`${row.turn}-${row.refId}-${i}`}>
                    <td>{row.turn + 1}</td>
                    <td>{row.action}</td>
                    <td>{row.stated}</td>
                    <td>
                      <span className={`tag tag-${row.verdict.toLowerCase()}`}>{row.verdict}</span>
                    </td>
                    <td className="muted">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel span-2">
          <h3>Signal audit</h3>
          {signals.length === 0 ? (
            <p className="muted">You sent no signals.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Signal</th>
                  <th>Class</th>
                  <th>Budget</th>
                  <th>PC</th>
                  <th>Δ perceived resolve</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((row, i) => (
                  <tr key={`${row.turn}-${row.cardId}-${i}`}>
                    <td>{row.turn + 1}</td>
                    <td>{content.cardsById[row.cardId]?.title ?? row.cardId}</td>
                    <td>{row.type}</td>
                    <td className="num">{row.budget}</td>
                    <td className="num">{row.politicalCapital}</td>
                    <td className="num">{row.resolveDelta.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
