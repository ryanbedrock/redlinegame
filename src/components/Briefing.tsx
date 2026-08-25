import mapAmberApproaches from '../assets/amber-approaches.webp';
import type { ContentPack, GameState } from '../engine';
import { RESPONSE_ORDINAL, SIGNAL_CLASSES, type ResponseType } from '../engine';
import { useGameStore } from '../store/gameStore';
import { TRACK_LABELS } from './Hud';

// Plain-language reading of each rung of the response ladder, in ascending
// order of commitment.
const RESPONSE_LADDER = (Object.keys(RESPONSE_ORDINAL) as ResponseType[]).sort(
  (a, b) => RESPONSE_ORDINAL[a] - RESPONSE_ORDINAL[b],
);

const RESPONSE_GLOSS: Record<ResponseType, string> = {
  CONCEDE: 'Yield the point. Cheapest today; it shifts the baseline in the Rival\u2019s favour.',
  PROTEST: 'Words only. Registers displeasure at almost no cost \u2014 and is read that way.',
  MATCH: 'Meet the move in kind. The floor most declaratory commitments demand.',
  ENFORCE: 'Impose a cost on the Rival. Expensive in political capital, legible as resolve.',
  ESCALATE: 'Raise the stakes above the provocation. Deters, and feeds the spiral.',
};

const SIGNAL_CLASS_GLOSS: Record<string, string> = {
  CHEAP: 'Declaratory. Talk is discounted by every adversary type.',
  SUNK: 'Money already spent \u2014 forces, basing, exercises. Credible because it is irreversible.',
  TIED_HANDS:
    'Public commitments and treaties. They raise the cost of backing down on you, deliberately.',
  REASSURANCE:
    'Transparency, limits, restraint. Cools a Rival that arms out of fear; wasted on one that arms out of appetite.',
};

const TRACK_GLOSS: Record<string, string> = {
  denial: 'Ability to defeat the move itself. Defensive-coded: deters without inflaming.',
  punishment: 'Ability to impose costs after the fact. Potent, and offensive-coded.',
  intelligence: 'Quality of your reporting. Every level narrows the error band on estimates.',
  readiness: 'Ability to act on short notice. Shortens the lead time on what you buy.',
};

// Pre-game read-in: the situation, the mechanics of a quarter, the resources,
// the adversary problem, and how the exercise is assessed. Shown once, between
// scenario select and the first situation report.
export function Briefing({
  state,
  content,
}: {
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const acknowledgeBriefing = useGameStore((s) => s.acknowledgeBriefing);
  const closeBriefing = useGameStore((s) => s.closeBriefing);
  const reset = useGameStore((s) => s.reset);
  // When reopened from the HUD mid-campaign, the briefing is a reference
  // document: one button back to the game, no reset to scenario select.
  const reopened = useGameStore((s) => s.briefingAcknowledged);

  const { scenario } = content;
  const years = scenario.turnCount / 4;
  const opening = scenario.opening;
  const tuning = scenario.tuning;
  const signalClasses = SIGNAL_CLASSES.filter((c) =>
    content.signals.some((card) => card.signalType === c),
  );

  return (
    <main className="landing briefing">
      <header>
        <p className="classification">
          Secret &mdash; exercise use only &middot; Directive {scenario.id.toUpperCase()} &middot;
          Serial {state.meta.seed}
        </p>
        <h1>{scenario.name}</h1>
        <p className="subtitle">Read-in for the National Security Principal</p>
      </header>

      <section className="panel">
        <h3>1. Situation</h3>
        <figure className="theatre-map">
          <img
            src={mapAmberApproaches}
            alt="Chart of the Amber Approaches: Meridian Federation to the west, the Verdant Dominion to the east, the disputed claim line running down the strait between them."
          />
          <figcaption>
            Figure 1 &mdash; The Amber Approaches. Basing and patrol envelopes notional; the claim
            line is the Dominion&rsquo;s, not one you have recognised.
          </figcaption>
        </figure>
        <p>{scenario.flavor}</p>
        <p className="muted">{scenario.description}</p>
      </section>

      <section className="panel">
        <h3>2. Mission</h3>
        <p>
          You hold the deterrence portfolio for {scenario.turnCount} consecutive quarters &mdash;{' '}
          {years} years of pre-war competition. Deter the Rival from overturning the status quo
          without triggering the war you are trying to prevent. Both failures are available to you,
          and one of them looks like success right up to the end.
        </p>
        <ul className="plain">
          <li>
            <strong>Deterrence holds</strong> if you reach the end of quarter {scenario.turnCount}
            &nbsp;with the status quo intact.
          </li>
          <li>
            <strong>Capitulation</strong> if status-quo integrity, presently{' '}
            {opening.statusQuoIntegrity}, is sliced to zero. Each concession takes a piece; after{' '}
            {tuning.concessionSalamiThreshold} in a row the Rival ratchets the next demand.
          </li>
          <li>
            <strong>War</strong> if the Rival&rsquo;s expected payoff from fighting stays above its
            threshold for {tuning.warThresholdConsecutiveTurns} consecutive quarters. There is no
            warning bell.
          </li>
        </ul>
      </section>

      <section className="panel">
        <h3>3. Conduct of a quarter</h3>
        <p className="muted">
          Every quarter runs the same four steps. Nothing you buy takes effect the moment you buy
          it.
        </p>
        <ol className="plain steps">
          <li>
            <strong>Situation report.</strong> Your posture, the intelligence estimate, and staff
            correspondence. Estimates are point readings with an error band, not facts &mdash; and
            the Rival can deliberately bias one.
          </li>
          <li>
            <strong>Provocation.</strong> The Rival tests you somewhere on a 1&ndash;5 severity
            ladder. You answer on the response ladder below, and state the reason of record for your
            choice.
          </li>
          <li>
            <strong>Signals and investments.</strong> Spend the quarterly allowance on posture and
            declarations. Investments land after a lead time; signals sit on cooldowns.
          </li>
          <li>
            <strong>Resolution.</strong> The Rival updates its read of your resolve, threat, and
            capability, then sets next quarter&rsquo;s move. You see the deltas, not its
            reasoning.
          </li>
        </ol>
      </section>

      <section className="panel">
        <h3>4. Response ladder</h3>
        <table className="table">
          <tbody>
            {RESPONSE_LADDER.map((r) => (
              <tr key={r}>
                <td>
                  <strong>{r}</strong>
                </td>
                <td className="muted">{RESPONSE_GLOSS[r]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          A declaratory commitment names a floor on this ladder and the provocations it covers.
          Answer at or above the floor and you honor it and gain standing; answer below it and the
          commitment is broken permanently. A red line you back away from is worse than one you
          never drew.
        </p>
      </section>

      <section className="panel">
        <h3>5. Means at your disposal</h3>
        <table className="table">
          <tbody>
            <tr>
              <td>Budget on hand</td>
              <td className="num">{opening.budget}</td>
              <td className="muted">+{tuning.budgetIncome} appropriated each quarter</td>
            </tr>
            <tr>
              <td>Political Capital</td>
              <td className="num">{opening.politicalCapital}</td>
              <td className="muted">
                +{tuning.pcRegenPerTurn} per quarter, capped at {tuning.pcCap}; commitments charge
                upkeep
              </td>
            </tr>
            {Object.entries(opening.tracks).map(([track, level]) => (
              <tr key={track}>
                <td>{TRACK_LABELS[track] ?? track}</td>
                <td className="num">{level}</td>
                <td className="muted">{TRACK_GLOSS[track]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4>Classes of signal</h4>
        <ul className="plain">
          {signalClasses.map((c) => (
            <li key={c}>
              <strong>{c.replace(/_/g, ' ')}</strong> &mdash;{' '}
              <span className="muted">{SIGNAL_CLASS_GLOSS[c]}</span>
            </li>
          ))}
        </ul>
        <p className="muted">
          Visible build-ups are not free of consequence: punishment and readiness raise the
          Rival&rsquo;s threat perception, denial barely does.
        </p>
      </section>

      <section className="panel">
        <h3>6. The adversary problem</h3>
        <p>
          The Rival is one of the following, fixed at the start of the exercise and never announced.
          The same posture that deters one of them provokes another, so diagnosis is a task in its
          own right.
        </p>
        <ul className="plain">
          {Object.entries(content.diagnosis.typeDescriptions).map(([type, desc]) => (
            <li key={type}>
              <strong>{type.replace(/_/g, ' ')}</strong> &mdash;{' '}
              <span className="muted">{desc}</span>
            </li>
          ))}
        </ul>
        <p className="muted">
          You will be asked to commit to an assessment as evidence accumulates. Declining to commit
          is permitted and scored as such.
        </p>
      </section>

      <section className="panel">
        <h3>7. Assessment</h3>
        <p className="muted">
          The after-action review scores you on five weighted measures, and replays your decisions
          against alternate versions of the Rival to see whether your strategy was sound or merely
          lucky.
        </p>
        <table className="table">
          <tbody>
            {Object.entries(scenario.scoring.weights).map(([k, w]) => (
              <tr key={k}>
                <td>{k[0].toUpperCase() + k.slice(1)}</td>
                <td className="num">{Math.round(w * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="actions">
        {reopened ? (
          <button className="primary" onClick={closeBriefing}>
            Return to the game
          </button>
        ) : (
          <>
            <button className="primary" onClick={acknowledgeBriefing}>
              Acknowledge &mdash; assume the portfolio
            </button>
            <button onClick={reset}>Return to scenario select</button>
          </>
        )}
      </div>
    </main>
  );
}
