import { useState } from 'react';
import {
  RIVAL_TYPES,
  buildPlayerVars,
  evalBool,
  type Card,
  type ContentPack,
  type GameState,
  type RivalType,
} from '../engine';
import { useGameStore } from '../store/gameStore';
import { Hud, TRACK_LABELS } from './Hud';

interface CardStatus {
  card: Card;
  draftedCount: number;
  affordable: boolean;
  available: boolean;
  atMaxPurchases: boolean;
  onCooldown: boolean;
}

function evaluateCard(
  card: Card,
  state: GameState,
  content: ContentPack,
  draftedCounts: Record<string, number>,
  remaining: { budget: number; politicalCapital: number },
): CardStatus {
  const drafted = draftedCounts[card.id] ?? 0;
  const owned = (state.player.purchaseCounts[card.id] ?? 0) + drafted;
  const last = state.player.lastPurchaseTurn[card.id];
  const onCooldown =
    card.cooldownTurns !== undefined &&
    last !== undefined &&
    state.meta.turnNumber - last < card.cooldownTurns;
  return {
    card,
    draftedCount: drafted,
    affordable:
      card.cost.budget <= remaining.budget &&
      card.cost.politicalCapital <= remaining.politicalCapital,
    available: card.availability
      ? evalBool(card.availability, buildPlayerVars(state, content))
      : true,
    atMaxPurchases: card.maxPurchases !== undefined && owned >= card.maxPurchases,
    onCooldown,
  };
}

function CardRow({
  status,
  content,
  rationaleId,
  onRationale,
}: {
  status: CardStatus;
  content: ContentPack;
  rationaleId: string;
  onRationale: (cardId: string, rationaleId: string) => void;
}): JSX.Element {
  const addPurchase = useGameStore((s) => s.addPurchase);
  const removePurchase = useGameStore((s) => s.removePurchase);
  const { card } = status;
  const set = content.rationales.find((r) => r.id === card.rationaleSetId);
  const blocked =
    !status.available || status.atMaxPurchases || status.onCooldown || !status.affordable;
  const reason = !status.available
    ? 'Prerequisites not met'
    : status.atMaxPurchases
      ? 'Purchase limit reached'
      : status.onCooldown
        ? `Cooling down (${card.cooldownTurns} quarters)`
        : !status.affordable
          ? 'Insufficient resources'
          : null;

  return (
    <li className={status.draftedCount > 0 ? 'card selected' : 'card'}>
      <div className="intel-head">
        <strong>{card.title}</strong>
        <span className="cost">
          {card.cost.budget} budget · {card.cost.politicalCapital} PC
        </span>
      </div>
      <p className="muted">{card.text}</p>
      <p className="meta">
        {card.family === 'SIGNAL' ? (
          <>
            <span className="tag">{card.signalType}</span>
            {card.offensiveCoded && <span className="tag tag-warn">offensive-coded</span>}
            {card.commitmentSpec && (
              <span className="tag">commits to {card.commitmentSpec.floorResponse}</span>
            )}
          </>
        ) : (
          <span className="tag">
            {TRACK_LABELS[card.track ?? ''] ?? card.track} → level {card.level} ·{' '}
            {card.leadTimeTurns}q lead
          </span>
        )}
      </p>
      {set && (
        <label className="rationale">
          Rationale
          <select value={rationaleId} onChange={(e) => onRationale(card.id, e.target.value)}>
            {set.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="options">
        <button
          className="primary"
          disabled={blocked}
          onClick={() => addPurchase(card.id, rationaleId)}
        >
          {status.draftedCount > 0 ? `Staged ×${status.draftedCount} — add another` : 'Stage'}
        </button>
        {status.draftedCount > 0 && (
          <button className="ghost" onClick={() => removePurchase(card.id)}>
            Remove
          </button>
        )}
        {reason && status.draftedCount === 0 && <span className="muted">{reason}</span>}
      </div>
    </li>
  );
}

export function SignalsInvestments({
  state,
  content,
}: {
  state: GameState;
  content: ContentPack;
}): JSX.Element {
  const setView = useGameStore((s) => s.setView);
  const draft = useGameStore((s) => s.draft);
  const setTypeBelief = useGameStore((s) => s.setTypeBelief);
  const [rationales, setRationales] = useState<Record<string, string>>({});

  const draftedCounts: Record<string, number> = {};
  let spentBudget = 0;
  let spentPc = 0;
  for (const p of draft.purchases) {
    draftedCounts[p.cardId] = (draftedCounts[p.cardId] ?? 0) + 1;
    const card = content.cardsById[p.cardId];
    if (card) {
      spentBudget += card.cost.budget;
      spentPc += card.cost.politicalCapital;
    }
  }
  const remaining = {
    budget: state.player.budget - spentBudget,
    politicalCapital: state.player.politicalCapital - spentPc,
  };

  const rationaleFor = (card: Card): string =>
    rationales[card.id] ??
    content.rationales.find((r) => r.id === card.rationaleSetId)?.options[0]?.id ??
    'unspecified';
  const onRationale = (cardId: string, rationaleId: string) =>
    setRationales((prev) => ({ ...prev, [cardId]: rationaleId }));

  const render = (cards: Card[]) => (
    <ul className="card-list">
      {cards.map((card) => (
        <CardRow
          key={card.id}
          status={evaluateCard(card, state, content, draftedCounts, remaining)}
          content={content}
          rationaleId={rationaleFor(card)}
          onRationale={onRationale}
        />
      ))}
    </ul>
  );

  return (
    <div className="screen">
      <Hud state={state} content={content} />
      <h2 className="phase-heading">Signals &amp; investments</h2>
      <p className="muted">
        Remaining this quarter: {remaining.budget.toFixed(1)} budget ·{' '}
        {remaining.politicalCapital.toFixed(1)} political capital
      </p>

      <section className="panel">
        <h3>Signals</h3>
        {render(content.signals)}
      </section>

      <section className="panel">
        <h3>Force posture investments</h3>
        {render(content.investments)}
      </section>

      <section className="panel">
        <h3>Diagnosis checkpoint</h3>
        <p className="muted">{content.diagnosis.promptText}</p>
        <div className="options options-column">
          {RIVAL_TYPES.map((t: RivalType) => (
            <button
              key={t}
              className={draft.typeBelief?.statedType === t ? 'option selected' : 'option'}
              onClick={() => setTypeBelief(t)}
            >
              <span className="option-type">{t.replace(/_/g, ' ')}</span>
              <span>{content.diagnosis.typeDescriptions[t]}</span>
            </button>
          ))}
          <button
            className={draft.typeBelief?.statedType === 'UNSURE' ? 'option selected' : 'option'}
            onClick={() => setTypeBelief('UNSURE')}
          >
            <span className="option-type">UNSURE</span>
            <span>{content.diagnosis.unsureText}</span>
          </button>
          {draft.typeBelief && (
            <button className="ghost" onClick={() => setTypeBelief(null)}>
              Withdraw assessment
            </button>
          )}
        </div>
      </section>

      <div className="actions">
        <button
          className="ghost"
          onClick={() => setView(state.world.stagedProbeId ? 'PROBE_RESPONSE' : 'SITREP')}
        >
          Back
        </button>
        <button className="primary" onClick={() => setView('RESOLUTION')}>
          Review &amp; resolve
        </button>
      </div>
    </div>
  );
}
