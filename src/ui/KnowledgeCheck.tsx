// Knowledge check (PRD §6.14) — a short formative quiz over the learning
// objectives, shown after the debrief. Immediate feedback with the authored
// explanation; no scoring pressure, purely reinforcement.

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function KnowledgeCheck(): JSX.Element | null {
  const content = useGameStore((s) => s.content);
  const goToStage = useGameStore((s) => s.goToStage);
  const backToMenu = useGameStore((s) => s.backToMenu);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!content) return null;
  const quiz = content.quiz;
  const answered = Object.keys(answers).length;
  const correctCount = quiz.filter((q) => {
    const chosen = answers[q.id];
    return chosen && q.options.find((o) => o.id === chosen)?.correct;
  }).length;

  return (
    <main className="screen knowledge">
      <h2 className="screen-title">Knowledge Check</h2>
      <p className="panel-note">
        A few questions on the theory this campaign exercised. Pick an answer to see why it is right or
        wrong — there is no grade, only the concept.
      </p>

      {answered > 0 && (
        <div className="quiz-progress" aria-live="polite">
          {correctCount} / {quiz.length} correct
        </div>
      )}

      <ol className="quiz-list">
        {quiz.map((q) => {
          const chosen = answers[q.id];
          const isAnswered = chosen !== undefined;
          return (
            <li key={q.id} className="quiz-item panel">
              <p className="quiz-lo">{q.lo}</p>
              <h3 className="quiz-q">{q.question}</h3>
              <div className="quiz-options" role="group" aria-label={q.question}>
                {q.options.map((o) => {
                  const state = !isAnswered
                    ? ''
                    : o.correct
                      ? 'correct'
                      : o.id === chosen
                        ? 'wrong'
                        : '';
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`quiz-option ${o.id === chosen ? 'chosen' : ''} ${state}`}
                      disabled={isAnswered}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {isAnswered && <p className="quiz-explain">{q.explanation}</p>}
            </li>
          );
        })}
      </ol>

      <div className="screen-actions">
        <button type="button" className="ghost" onClick={() => goToStage('DEBRIEF')}>
          ← Back to Debrief
        </button>
        <button type="button" className="primary" onClick={backToMenu}>
          Return to Menu
        </button>
      </div>
    </main>
  );
}
