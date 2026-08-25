import { useEffect, useMemo, useState } from 'react';
import { listScenarios, loadContentPack } from '../content-loader';
import { fetchPlatformSave, platformAvailable, type PlatformSave } from '../platformBridge';
import { useGameStore } from '../store/gameStore';

export function ScenarioSelect(): JSX.Element {
  const startGame = useGameStore((s) => s.startGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const [save, setSave] = useState<PlatformSave | null>(null);

  useEffect(() => {
    if (!platformAvailable()) return;
    let cancelled = false;
    void fetchPlatformSave().then((s) => {
      if (!cancelled) setSave(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const savedScenario = useMemo(() => {
    if (!save || save.state.meta.ending) return null;
    try {
      return loadContentPack(save.state.meta.scenarioId).scenario;
    } catch {
      return null;
    }
  }, [save]);
  const scenarios = useMemo(() => {
    return listScenarios().map((s) => {
      const { scenario } = loadContentPack(s.id);
      return {
        ...s,
        flavor: scenario.flavor,
        turnCount: scenario.turnCount,
        seed: scenario.defaultSeed,
        opening: scenario.opening,
        budgetIncome: scenario.tuning.budgetIncome,
      };
    });
  }, []);

  return (
    <main className="landing">
      <header>
        <p className="classification">Secret &mdash; exercise use only &middot; Directive index</p>
        <h1>The Red Line</h1>
        <p className="subtitle">Costly Signals in the Long Pre-War</p>
      </header>
      {save && savedScenario && (
        <section className="resume-banner">
          <h2>Campaign in progress</h2>
          <p>
            {savedScenario.name} &mdash; quarter {Math.min(save.state.meta.turnNumber + 1, savedScenario.turnCount)} of{' '}
            {savedScenario.turnCount}. Your campaign is saved after each committed quarter;
            resume where you left off, or open a new file below (starting a new campaign
            overwrites this save at its first committed quarter).
          </p>
          <button className="primary" onClick={() => resumeGame(save)}>
            Resume campaign
          </button>
        </section>
      )}
      <section>
        <p>
          Three files, one problem: deter an adversary whose intentions you cannot read directly,
          over years rather than moves, using instruments that all cost something and none of which
          are read the way you intend. Each file names its own opening position and horizon; the
          adversary&rsquo;s true character is fixed at the start and never announced.
        </p>
        <h2>Scenario files</h2>
        <ul className="scenario-list">
          {scenarios.map((s) => (
            <li key={s.id}>
              <div className="intel-head">
                <strong>{s.name}</strong>
                <span className="turns">
                  {s.turnCount} quarters &middot; {s.turnCount / 4} years
                </span>
              </div>
              <p>{s.description}</p>
              <p className="muted">{s.flavor}</p>
              <p className="scenario-facts">
                Opening: {s.opening.budget} budget (+{s.budgetIncome} per quarter) &middot;{' '}
                {s.opening.politicalCapital} Political Capital &middot; denial{' '}
                {s.opening.tracks.denial} / punishment {s.opening.tracks.punishment} / intelligence{' '}
                {s.opening.tracks.intelligence} / readiness {s.opening.tracks.readiness} &middot;
                Rival prior arming {s.opening.priorArmingLevel} &middot; serial {s.seed}
              </p>
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
