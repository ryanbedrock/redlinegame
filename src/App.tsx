import { useMemo } from 'react';
import { listScenarios, loadContentPack } from './content-loader';

// Phase 0 bootstrap. The full playable interface (SITREP, probe response,
// signals & investment, resolution, debrief, war epilogue) lands in the
// subsequent phases; this landing page verifies the content pipeline loads and
// the bundle builds. It performs no game logic.
export function App(): JSX.Element {
  const scenarios = useMemo(() => {
    return listScenarios().map((s) => {
      const pack = loadContentPack(s.id);
      return { ...s, turnCount: pack.scenario.turnCount };
    });
  }, []);

  return (
    <main className="landing">
      <header>
        <h1>The Red Line</h1>
        <p className="subtitle">Costly Signals in the Long Pre-War</p>
      </header>
      <section>
        <p>
          A serious game on deterrence, credibility, and the security dilemma. The engine, content
          pipeline, and counterfactual analysis are in place; the playable interface is under
          construction.
        </p>
        <h2>Scenarios</h2>
        <ul className="scenario-list">
          {scenarios.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong> <span className="turns">· {s.turnCount} quarters</span>
              <p>{s.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
