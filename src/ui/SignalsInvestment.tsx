// Signals & Investment — the quarter's orders. Signals resolve this quarter
// (costly-signaling: CHEAP/SUNK/TIED_HANDS/REASSURANCE); investments are queued
// and complete after their lead time. Affordability, availability, cooldown and
// purchase limits mirror the engine's guards so the UI never offers an illegal buy.

import { useGameStore } from '../store/gameStore';
import type { Card } from '../engine/types';
import { buildPlayerVars } from '../engine/context';
import { evalBool } from '../engine/conditions';
import { RationalePicker } from './RationalePicker';

const SIGNAL_TAG: Record<string, string> = {
  CHEAP: 'Cheap Talk',
  SUNK: 'Sunk Cost',
  TIED_HANDS: 'Tied Hands',
  REASSURANCE: 'Reassurance',
};

export function SignalsInvestment(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const draft = useGameStore((s) => s.draft);
  const togglePurchase = useGameStore((s) => s.togglePurchase);
  const setPurchaseRationale = useGameStore((s) => s.setPurchaseRationale);
  const goToStage = useGameStore((s) => s.goToStage);
  const commitTurn = useGameStore((s) => s.commitTurn);

  if (!state || !content) return null;

  const selectedIds = new Set(draft.purchases.map((p) => p.cardId));
  const selectedCards = draft.purchases
    .map((p) => content.cardsById[p.cardId])
    .filter((c): c is Card => Boolean(c));
  const spentBudget = selectedCards.reduce((sum, c) => sum + c.cost.budget, 0);
  const spentPc = selectedCards.reduce((sum, c) => sum + c.cost.politicalCapital, 0);
  const remainingBudget = state.player.budget - spentBudget;
  const remainingPc = state.player.politicalCapital - spentPc;

  const playerVars = buildPlayerVars(state, content);

  interface Eligibility {
    ok: boolean;
    reason?: string;
  }
  const eligibility = (card: Card): Eligibility => {
    if (selectedIds.has(card.id)) return { ok: true };
    const count = state.player.purchaseCounts[card.id] ?? 0;
    if (card.maxPurchases !== undefined && count >= card.maxPurchases) return { ok: false, reason: 'Already built' };
    const last = state.player.lastPurchaseTurn[card.id];
    if (card.cooldownTurns !== undefined && last !== undefined && state.meta.turnNumber - last < card.cooldownTurns) {
      return { ok: false, reason: `On cooldown (${card.cooldownTurns - (state.meta.turnNumber - last)}q)` };
    }
    if (card.availability && !evalBool(card.availability, playerVars)) return { ok: false, reason: 'Locked' };
    if (card.cost.budget > remainingBudget) return { ok: false, reason: 'Insufficient budget' };
    if (card.cost.politicalCapital > remainingPc) return { ok: false, reason: 'Insufficient capital' };
    return { ok: true };
  };

  const defaultRationale = (card: Card): string =>
    content.rationales.find((r) => r.id === card.rationaleSetId)?.options[0]?.id ?? 'auto';

  const renderCard = (card: Card): JSX.Element => {
    const selected = selectedIds.has(card.id);
    const elig = eligibility(card);
    const disabled = !selected && !elig.ok;
    const purchase = draft.purchases.find((p) => p.cardId === card.id);
    return (
      <div key={card.id} className={`gcard ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
        <button
          type="button"
          className="gcard-body"
          aria-pressed={selected}
          disabled={disabled}
          onClick={() => togglePurchase(card.id, defaultRationale(card))}
        >
          <div className="gcard-head">
            <span className="gcard-title">{card.title}</span>
            {card.signalType && <span className={`sig-tag t-${card.signalType.toLowerCase()}`}>{SIGNAL_TAG[card.signalType]}</span>}
            {card.family === 'TRACK_LEVEL' && (
              <span className="lead-tag">
                {card.track} → {card.level} · {card.leadTimeTurns}q
              </span>
            )}
          </div>
          <p className="gcard-text">{card.text}</p>
          <div className="gcard-foot">
            <span className="cost">
              {card.cost.budget > 0 && <span>{card.cost.budget}B</span>}
              {card.cost.politicalCapital > 0 && <span>{card.cost.politicalCapital}PC</span>}
              {card.cost.budget === 0 && card.cost.politicalCapital === 0 && <span>Free</span>}
            </span>
            {card.offensiveCoded && <span className="offensive" title="Reads as offensive to a nervous Rival">offensive-coded</span>}
            {!elig.ok && !selected && <span className="lock-reason">{elig.reason}</span>}
          </div>
        </button>
        {selected && (
          <div className="gcard-rationale">
            <RationalePicker
              id={`rationale-${card.id}`}
              set={content.rationales.find((r) => r.id === card.rationaleSetId)}
              value={purchase?.rationaleId ?? defaultRationale(card)}
              onChange={(rid) => setPurchaseRationale(card.id, rid)}
            />
          </div>
        )}
      </div>
    );
  };

  const probeStaged = Boolean(state.world.stagedProbeId);
  const probeAnswered = Boolean(draft.probeResponse);

  return (
    <div className="screen orders">
      <h2 className="screen-title">Signals &amp; Investment</h2>

      <div className="orders-budget">
        <span>Remaining this quarter:</span>
        <strong className={remainingBudget < 0 ? 'over' : ''}>{Math.round(remainingBudget)} Budget</strong>
        <strong className={remainingPc < 0 ? 'over' : ''}>{Math.round(remainingPc)} Political Capital</strong>
      </div>

      <section className="panel">
        <h3>Signals <span className="muted">— resolve this quarter</span></h3>
        <div className="card-grid">{content.signals.map(renderCard)}</div>
      </section>

      <section className="panel">
        <h3>Investments <span className="muted">— complete after lead time</span></h3>
        <div className="card-grid">{content.investments.map(renderCard)}</div>
      </section>

      {probeStaged && !probeAnswered && (
        <div className="alert warn" role="alert">
          You have not answered this quarter's probe. Committing now counts as inaction — a concession.{' '}
          <button type="button" className="linkish" onClick={() => goToStage('PROBE')}>
            Respond first
          </button>
        </div>
      )}

      <div className="screen-actions">
        <button type="button" className="ghost" onClick={() => goToStage(probeStaged ? 'PROBE' : 'SITREP')}>
          ← Back
        </button>
        <button type="button" className="primary commit" onClick={commitTurn}>
          Commit Quarter →
        </button>
      </div>
    </div>
  );
}
