import type { ContentPack, GameState } from '../engine';
import { useGameStore } from '../store/gameStore';
import { Hud } from './Hud';

export function Epilogue({
  state,
  content,
}: {
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const commitEpilogue = useGameStore((s) => s.commitEpilogue);
  const eTurn = state.meta.epilogueTurn ?? 1;
  const decision = content.epilogue.decisions[eTurn - 1];

  return (
    <div className="screen">
      <Hud state={state} content={content} />
      <h2 className="phase-heading">
        War epilogue · decision {eTurn} of {content.epilogue.decisions.length}
      </h2>
      {!decision ? (
        <p className="muted">No further decisions.</p>
      ) : (
        <section className="panel">
          <h3>{decision.title}</h3>
          <p>{decision.text}</p>
          <div className="options options-column">
            {decision.options.map((opt) => (
              <button
                key={opt.id}
                className="option"
                onClick={() => commitEpilogue(decision.id, opt.id)}
              >
                <span>{opt.label}</span>
                {opt.terminationLeverage && (
                  <span className="tag">punishment leverage applies</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
      {state.epilogue && (
        <p className="muted">
          Projected war outcome: {state.epilogue.finalOutcome.toFixed(1)} (posture base{' '}
          {state.epilogue.warOutcomeBase.toFixed(1)})
        </p>
      )}
    </div>
  );
}
