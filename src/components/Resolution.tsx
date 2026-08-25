import { TRACK_IDS, type ContentPack, type GameState } from '../engine';
import { useGameStore } from '../store/gameStore';
import { Hud, TRACK_LABELS } from './Hud';

function signed(n: number, digits = 1): string {
  const v = Number(n.toFixed(digits));
  return v > 0 ? `+${v}` : `${v}`;
}

type Takeaway = { tone: 'good' | 'warn' | 'info'; text: string };

function buildTakeaways(state: GameState, content: ContentPack): Takeaway[] {
  const out: Takeaway[] = [];
  const record = state.analytics.turnRecords[state.analytics.turnRecords.length - 1];
  if (!record) return out;
  const probeRecord = state.world.probeLog.find((p) => p.turn === record.turn);
  const history = state.analytics.perceptionHistory;
  const snapshot = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : undefined;
  const tuning = content.scenario.tuning;

  if (probeRecord) {
    const title =
      content.probes.find((p) => p.id === probeRecord.probeId)?.title ?? probeRecord.probeId;
    if (record.concessionStreak > 0) {
      const words =
        probeRecord.responseType === 'PROTEST'
          ? 'A protest is words, and words alone do not defend the line: '
          : '';
      const atThreshold = record.concessionStreak >= tuning.concessionSalamiThreshold;
      out.push({
        tone: 'warn',
        text:
          `Your ${probeRecord.responseType} to the ${title} was read as a concession. ${words}` +
          `status-quo integrity gave up ${Math.abs(probeRecord.statusQuoDelta).toFixed(1)} points, and your concession streak is now ` +
          `${record.concessionStreak} of ${tuning.concessionSalamiThreshold}. ` +
          (atThreshold
            ? 'The Rival will now escalate its next demand — harder provocations, bigger slices.'
            : `Reach ${tuning.concessionSalamiThreshold} in a row and the Rival escalates its next demand.`),
      });
    } else if (probeRecord.responseType === 'MATCH') {
      out.push({
        tone: 'good',
        text: `You met the ${title} at parity: nothing conceded, no new escalation, and any concession streak is reset.`,
      });
    } else {
      out.push({
        tone: 'good',
        text:
          `You pushed back on the ${title} above parity. The line held and the streak reset, ` +
          'but visible force makes you look more threatening — watch threat perception if you keep it up.',
      });
    }
  } else {
    out.push({
      tone: 'info',
      text: 'A quiet quarter on the line — no provocation required an answer.',
    });
  }

  const pending = state.player.pendingInvestments;
  if (pending.length > 0) {
    const soonest = Math.min(...pending.map((p) => p.turnsRemaining));
    out.push({
      tone: 'info',
      text:
        `Your spending has not vanished: ${pending.length} investment${pending.length === 1 ? '' : 's'} ` +
        `${pending.length === 1 ? 'is' : 'are'} in the pipeline and will land in ` +
        `${soonest <= 0 ? 'the coming quarter' : `${soonest} quarter${soonest === 1 ? '' : 's'}`}. ` +
        'Track gains appear in the ledger only when an investment arrives.',
    });
  }

  if (snapshot) {
    const streak = state.rival.warUtilityStreak;
    if (streak > 0) {
      const limit = tuning.warThresholdConsecutiveTurns;
      out.push({
        tone: 'warn',
        text:
          `War utility (${snapshot.warUtility.toFixed(2)}) has been above the Rival's war line for ` +
          `${streak} consecutive quarter${streak === 1 ? '' : 's'} — ${limit} in a row and the game ends in WAR. ` +
          'Cool it down: avoid feeding threat perception, and do not look like an easy win.',
      });
    } else {
      out.push({
        tone: 'good',
        text:
          `War utility (${snapshot.warUtility.toFixed(2)}) is below the Rival's war line — no momentum toward war this quarter.`,
      });
    }
    if (prev) {
      const dr = snapshot.perceivedResolve - prev.perceivedResolve;
      if (Math.abs(dr) >= 0.005) {
        out.push({
          tone: 'info',
          text:
            `The Rival's read of your resolve moved ${signed(dr, 2)} to ${snapshot.perceivedResolve.toFixed(2)}. ` +
            'Perception updates slowly and noisily — one quarter rarely moves it far, and the number is their estimate, not the truth.',
        });
      }
    }
  }

  return out;
}

export function Resolution({
  state,
  content,
}: {
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const setView = useGameStore((s) => s.setView);
  const draft = useGameStore((s) => s.draft);
  const turnResolved = useGameStore((s) => s.turnResolved);
  const commitTurn = useGameStore((s) => s.commitTurn);
  const continueAfterResolution = useGameStore((s) => s.continueAfterResolution);

  if (!turnResolved) {
    const probe = content.probes.find((p) => p.id === state.world.stagedProbeId);
    return (
      <div className="screen">
        <Hud state={state} content={content} />
        <h2 className="phase-heading">Confirm the quarter</h2>
        <section className="panel">
          <h3>Orders of record</h3>
          <table className="table">
            <tbody>
              <tr>
                <td>Probe response</td>
                <td>
                  {draft.probeResponse
                    ? `${probe?.title ?? draft.probeResponse.probeId} — ${draft.probeResponse.responseType}`
                    : probe
                      ? 'No response ordered (treated as a concession)'
                      : 'No probe this quarter'}
                </td>
              </tr>
              <tr>
                <td>Purchases</td>
                <td>
                  {draft.purchases.length === 0
                    ? 'None'
                    : draft.purchases
                        .map((p) => content.cardsById[p.cardId]?.title ?? p.cardId)
                        .join(', ')}
                </td>
              </tr>
              <tr>
                <td>Correspondence</td>
                <td>{draft.inboxResponses?.length ?? 0} response(s)</td>
              </tr>
              <tr>
                <td>Type assessment</td>
                <td>{draft.typeBelief?.statedType.replace(/_/g, ' ') ?? 'Not stated'}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <div className="actions">
          <button className="ghost" onClick={() => setView('SIGNALS')}>
            Back
          </button>
          <button className="primary" onClick={commitTurn}>
            Resolve quarter
          </button>
        </div>
      </div>
    );
  }

  const record = state.analytics.turnRecords[state.analytics.turnRecords.length - 1];
  const snapshot = state.analytics.perceptionHistory[state.analytics.perceptionHistory.length - 1];
  const probeRecord = record
    ? state.world.probeLog.find((p) => p.turn === record.turn)
    : undefined;

  return (
    <div className="screen">
      <Hud state={state} content={content} />
      <h2 className="phase-heading">Quarter {record ? record.turn + 1 : ''} resolved</h2>
      <div className="grid">
        <section className="panel">
          <h3>Ledger</h3>
          {record && (
            <table className="table">
              <tbody>
                <tr>
                  <td>Budget</td>
                  <td className="num">{signed(record.deltas.budget)}</td>
                </tr>
                <tr>
                  <td>Political capital</td>
                  <td className="num">{signed(record.deltas.politicalCapital)}</td>
                </tr>
                <tr>
                  <td>Status-quo integrity</td>
                  <td className="num">{signed(record.deltas.statusQuoIntegrity)}</td>
                </tr>
                {TRACK_IDS.map((t) => (
                  <tr key={t}>
                    <td>{TRACK_LABELS[t]}</td>
                    <td className="num">{signed(record.deltas.tracks[t], 0)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Concession streak</td>
                  <td className="num">{record.concessionStreak}</td>
                </tr>
              </tbody>
            </table>
          )}
          {probeRecord && (
            <p className="muted">
              {content.probes.find((p) => p.id === probeRecord.probeId)?.title ??
                probeRecord.probeId}{' '}
              met with {probeRecord.responseType} (baseline shift{' '}
              {signed(probeRecord.statusQuoDelta)}).
            </p>
          )}
        </section>

        <section className="panel">
          <h3>Events</h3>
          {!record || record.eventIds.length === 0 ? (
            <p className="muted">No events this quarter.</p>
          ) : (
            <ul className="plain">
              {record.eventIds.map((id) => {
                const ev = content.events.find((e) => e.id === id);
                return (
                  <li key={id}>
                    <strong>{ev?.title ?? id}</strong>
                    <p className="muted">{ev?.text}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel span-2">
          <h3>What this means</h3>
          <ul className="takeaways">
            {buildTakeaways(state, content).map((t, i) => (
              <li key={i} className={`takeaway ${t.tone}`}>
                {t.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel span-2">
          <h3>Perception snapshot</h3>
          {snapshot && (
            <table className="table">
              <tbody>
                <tr>
                  <td>Perceived resolve</td>
                  <td className="num">{snapshot.perceivedResolve.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Perceived capability</td>
                  <td className="num">{snapshot.perceivedCapability.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Threat perception</td>
                  <td className="num">{snapshot.threatPerception.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>War utility</td>
                  <td className="num">{snapshot.warUtility.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Internal pressure</td>
                  <td className="num">{snapshot.internalPressure.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>
      </div>

      {state.meta.ending && (
        <p className="ending-banner">Outcome: {state.meta.ending.replace(/_/g, ' ')}</p>
      )}

      <div className="actions">
        <button
          className="primary"
          onClick={() => {
            if (state.meta.phase === 'SITREP') continueAfterResolution();
            else setView(state.meta.phase);
          }}
        >
          {state.meta.phase === 'SITREP'
            ? 'Next quarter'
            : state.meta.phase === 'EPILOGUE'
              ? 'To the war epilogue'
              : 'To the debrief'}
        </button>
      </div>
    </div>
  );
}
