// War Epilogue — four decisions of the opening campaign after deterrence fails.
// Outcomes are shaped by the denial/readiness/punishment you built before the
// war, not by fresh resources. This is the cost of failed deterrence made concrete.

import { useGameStore } from '../store/gameStore';

export function Epilogue(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const commitEpilogue = useGameStore((s) => s.commitEpilogue);

  if (!state || !content || !state.epilogue) return null;

  const eTurn = state.meta.epilogueTurn ?? 1;
  const decision = content.epilogue.decisions[eTurn - 1];
  if (!decision) return null;

  return (
    <div className="screen epilogue">
      <div className="epilogue-progress">
        Opening Campaign · Move {eTurn} of {content.epilogue.decisions.length}
      </div>
      <h2 className="screen-title">{decision.title}</h2>
      <p className="screen-intro">{decision.text}</p>

      <div className="epilogue-options">
        {decision.options.map((o) => (
          <button key={o.id} type="button" className="epilogue-option" onClick={() => commitEpilogue(o.id)}>
            <span className="opt-label">{o.label}</span>
            {o.terminationLeverage && (
              <span className="opt-note">Leverage scales with the punishment reach you built.</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
