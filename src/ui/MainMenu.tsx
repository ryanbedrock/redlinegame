// Landing / campaign-select. Start a new campaign against a hidden Rival, or
// resume an event-sourced save. The Rival's type is never shown here — it is
// seeded and hidden until the debrief.

import { useMemo, useState } from 'react';
import { listScenarios, loadContentPack } from '../content-loader';
import { useGameStore } from '../store/gameStore';
import { listSaves, deleteSave, type SaveGame } from '../store/persistence';

export function MainMenu(): JSX.Element {
  const newGame = useGameStore((s) => s.newGame);
  const resume = useGameStore((s) => s.resume);

  const scenarios = useMemo(
    () =>
      listScenarios().map((s) => {
        const pack = loadContentPack(s.id);
        return { ...s, turnCount: pack.scenario.turnCount, defaultSeed: pack.scenario.defaultSeed };
      }),
    [],
  );

  const [saves, setSaves] = useState<SaveGame[]>(() => listSaves());
  const [selected, setSelected] = useState<string>(scenarios[0]?.id ?? '');
  const [seedText, setSeedText] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');

  const current = scenarios.find((s) => s.id === selected) ?? scenarios[0];

  const start = () => {
    if (!current) return;
    const seed = seedText.trim() === '' ? current.defaultSeed : Number(seedText);
    if (!Number.isFinite(seed)) return;
    newGame(current.id, Math.trunc(seed), displayName.trim() || undefined);
  };

  const doResume = (id: string) => resume(id);
  const doDelete = (id: string) => {
    deleteSave(id);
    setSaves(listSaves());
  };

  return (
    <main className="menu">
      <header className="menu-header">
        <div className="menu-mark" aria-hidden="true" />
        <div>
          <h1>THE RED LINE</h1>
          <p className="subtitle">Costly Signals in the Long Pre-War</p>
        </div>
      </header>

      <p className="menu-brief">
        You direct the national security of a fictional state facing a rising Rival across a contested
        frontier. Over a series of fiscal quarters you must deter aggression without provoking the very
        war you seek to prevent — reading an adversary whose true nature is hidden, and choosing when to
        signal, invest, and hold the line.
      </p>

      <section className="menu-panels">
        <div className="panel new-campaign">
          <h2>New Campaign</h2>
          <div className="scenario-picker" role="radiogroup" aria-label="Scenario">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === selected}
                className={`scenario-option ${s.id === selected ? 'selected' : ''}`}
                onClick={() => setSelected(s.id)}
              >
                <span className="scenario-name">{s.name}</span>
                <span className="scenario-meta">{s.turnCount} quarters</span>
                <span className="scenario-desc">{s.description}</span>
              </button>
            ))}
          </div>

          <div className="new-controls">
            <label>
              <span>Commander (optional)</span>
              <input
                type="text"
                value={displayName}
                maxLength={40}
                placeholder="Your name or handle"
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label>
              <span>Seed (optional)</span>
              <input
                type="text"
                inputMode="numeric"
                value={seedText}
                placeholder={current ? String(current.defaultSeed) : ''}
                onChange={(e) => setSeedText(e.target.value)}
              />
            </label>
          </div>
          <p className="seed-note">
            The same seed always produces the same hidden Rival and the same probes — play is fully
            deterministic. Leave blank to use the scenario default.
          </p>
          <button type="button" className="primary" onClick={start}>
            Begin Campaign
          </button>
        </div>

        <div className="panel resume-campaign">
          <h2>Resume</h2>
          {saves.length === 0 ? (
            <p className="empty">No saved campaigns yet.</p>
          ) : (
            <ul className="save-list">
              {saves.map((s) => (
                <li key={s.id}>
                  <div className="save-info">
                    <span className="save-name">{s.displayName || 'Unnamed commander'}</span>
                    <span className="save-meta">
                      {scenarios.find((sc) => sc.id === s.scenarioId)?.name ?? s.scenarioId} · seed {s.seed} ·{' '}
                      {s.decisionLog.length} quarters played
                    </span>
                  </div>
                  <div className="save-actions">
                    <button type="button" className="primary" onClick={() => doResume(s.id)}>
                      Resume
                    </button>
                    <button type="button" className="ghost danger" onClick={() => doDelete(s.id)} aria-label={`Delete save ${s.displayName || s.id}`}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="menu-footer">
        <span>Offline · deterministic · no network. A serious game on deterrence theory.</span>
      </footer>
    </main>
  );
}
