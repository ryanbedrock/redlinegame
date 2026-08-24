import { useMemo } from 'react';
import { listScenarios, loadContentPack } from '../content-loader';
import { useGameStore } from '../store/gameStore';

export function ScenarioSelect(): JSX.Element {
  const startGame = useGameStore((s) => s.startGame);
  const scenarios = useMemo(() => {
    return listScenarios().map((s) => {
      const pack = loadContentPack(s.id);
      return { ...s, turnCount: pack.scenario.turnCount, seed: pack.scenario.defaultSeed };
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
          A serious game on deterrence, credibility, and the security dilemma. Choose a scenario and
          hold the line — or discover what your signals were really worth.
        </p>
        <h2>Scenarios</h2>
        <ul className="scenario-list">
          {scenarios.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong> <span className="turns">· {s.turnCount} quarters</span>
              <p>{s.description}</p>
              <button className="primary" onClick={() => startGame(s.id)}>
                Take command
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
