// Tutorial — a short, paged orientation to the loop and the vocabulary, for a
// first-time commander. Static; no engine access. Advances through cards.

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface Page {
  title: string;
  body: string[];
}

const PAGES: Page[] = [
  {
    title: 'Your mandate',
    body: [
      'You direct national security for a fictional state facing a rising Rival across a contested frontier.',
      'Each turn is a fiscal quarter. Your job across the campaign: deter aggression without provoking the war you are trying to prevent.',
    ],
  },
  {
    title: 'The quarter loop',
    body: [
      'SITREP: read your (noisy) intelligence and see any incoming probe.',
      'Probe Response: choose where to sit on the ladder from Concede up to Escalate.',
      'Signals & Investment: spend budget and political capital on signals (this quarter) and investments (which complete after a lead time).',
      'Resolution: see what moved, then advance to the next quarter.',
    ],
  },
  {
    title: 'Signals are costly — or they are noise',
    body: [
      'Cheap talk is nearly free and rarely believed. Sunk-cost signals burn resources visibly. Tied-hands commitments impose a domestic penalty if you later back down — which is exactly what makes them credible.',
      'Reassurance lowers a fearful Rival\u2019s threat perception at some cost to how resolved you look.',
    ],
  },
  {
    title: 'Denial vs. punishment',
    body: [
      'Denial investments make a Rival grab more likely to fail. Punishment investments threaten costly retaliation — but read as offensive, and can frighten a security-seeking Rival into arming.',
      'Intelligence tightens your estimates; readiness shortens the lead time on everything you build.',
    ],
  },
  {
    title: 'Read the Rival — then commit',
    body: [
      'The Rival\u2019s true nature is hidden. Log an assessment as evidence accumulates; your calibration is scored at the debrief.',
      'Hold the line against salami-slicing: a streak of small concessions cedes ground and teaches the Rival you will fold.',
    ],
  },
  {
    title: 'Determinism',
    body: [
      'A seed fixes the hidden Rival and the sequence of probes, so a campaign is fully replayable. Your save stores only your decisions — the state is rebuilt by replaying them.',
      'That is what makes the counterfactual debrief possible: the game can re-run the same seed under other doctrines and other Rival types to show how else it could have gone.',
    ],
  },
];

export function Tutorial(): JSX.Element {
  const backToMenu = useGameStore((s) => s.backToMenu);
  const [i, setI] = useState(0);
  const page = PAGES[i];
  const last = i === PAGES.length - 1;

  return (
    <main className="screen tutorial">
      <h2 className="screen-title">How to Play</h2>
      <div className="tutorial-card panel">
        <div className="tutorial-step" aria-hidden="true">
          {i + 1} / {PAGES.length}
        </div>
        <h3>{page.title}</h3>
        {page.body.map((p, k) => (
          <p key={k}>{p}</p>
        ))}
      </div>

      <div className="tutorial-dots" aria-hidden="true">
        {PAGES.map((_, k) => (
          <span key={k} className={`dot ${k === i ? 'active' : ''}`} />
        ))}
      </div>

      <div className="screen-actions">
        <button type="button" className="ghost" onClick={() => (i === 0 ? backToMenu() : setI(i - 1))}>
          {i === 0 ? 'Back to Menu' : '← Previous'}
        </button>
        <button type="button" className="primary" onClick={() => (last ? backToMenu() : setI(i + 1))}>
          {last ? 'Done' : 'Next →'}
        </button>
      </div>
    </main>
  );
}
