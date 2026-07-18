// About / Theory — the concepts the game models, for players who want the
// framework before or after playing. Static content; no engine access.

import { useGameStore } from '../store/gameStore';

interface Concept {
  term: string;
  body: string;
}

const CONCEPTS: Concept[] = [
  {
    term: 'Costly signals vs. cheap talk',
    body: 'A statement of intent costs nothing and can be bluffed. A signal is credible when only a genuinely resolved actor would pay its price — sinking cost into a visible exercise, or tying hands with a public commitment that carries a domestic penalty for backing down.',
  },
  {
    term: 'Audience costs',
    body: "Public commitments create a political penalty at home for reneging. That penalty is what makes the threat believed — but it decays if you are seen to back down, so hollow red lines are worse than none.",
  },
  {
    term: 'Deterrence by denial vs. by punishment',
    body: 'Denial lowers the probability an aggression succeeds (it attacks pSuccess). Punishment raises the cost after the fact. Denial is often more robust because it does not depend on the adversary crediting your resolve.',
  },
  {
    term: 'The security dilemma',
    body: "Measures you take to feel safer can make an adversary feel less safe, driving a spiral of arming. Against a fearful rival, offensive-coded build-ups can manufacture the very war they were meant to prevent.",
  },
  {
    term: 'Salami tactics',
    body: 'A series of individually-minor probes, each too small to justify war, can cumulatively erode your position and teach the adversary that you will not hold the line. A clear, honored threshold is the counter.',
  },
  {
    term: 'Perception asymmetry',
    body: "You never see the Rival's true type or its internal ledgers during play — only noisy intelligence. The Rival, likewise, reads you through a fog. Deterrence is management of beliefs under uncertainty.",
  },
  {
    term: 'Reading the Rival',
    body: 'Three hidden types behave differently: an Opportunist probes for cheap gains and folds when enforced; a Pressured Expansionist escalates on a closing internal window regardless of your firmness; a Security Seeker arms in reaction to your threat signature. The same move can deter one and provoke another.',
  },
];

export function About(): JSX.Element {
  const backToMenu = useGameStore((s) => s.backToMenu);
  return (
    <main className="screen about">
      <h2 className="screen-title">About &amp; Theory</h2>
      <p className="panel-note">
        The Red Line is a serious game about deterrence under uncertainty. It is fiction — no real states,
        forces, or operations — built to exercise the following ideas.
      </p>
      <dl className="concept-list">
        {CONCEPTS.map((c) => (
          <div key={c.term} className="concept panel">
            <dt>{c.term}</dt>
            <dd>{c.body}</dd>
          </div>
        ))}
      </dl>
      <div className="screen-actions">
        <button type="button" className="primary" onClick={backToMenu}>
          ← Back to Menu
        </button>
      </div>
    </main>
  );
}
