// ============================================================================
// Rationale coherence: did the stated reason for a decision match the decision
// actually taken? Pure module over the recorded decision log; no side effects.
// ============================================================================

import type { ContentPack, DecisionRecord, GameState, ResponseType } from './types';
import { clamp } from './formulas';

const RESPONSE_ORDER: ResponseType[] = [
  'CONCEDE',
  'PROTEST',
  'MATCH',
  'ENFORCE',
  'ESCALATE',
];

function ordinal(r: ResponseType): number {
  return RESPONSE_ORDER.indexOf(r);
}

export type CoherenceVerdict = 'CONSISTENT' | 'MISMATCH' | 'UNSCORED';

export interface CoherenceRow {
  turn: number;
  kind: DecisionRecord['kind'];
  refId: string;
  action: string; // what was actually done
  stated: string; // the rationale label the player picked
  verdict: CoherenceVerdict;
  note: string;
}

export interface CoherenceReport {
  rows: CoherenceRow[];
  scored: number;
  mismatches: number;
  // null when nothing scoreable was justified: there is no coherence to judge,
  // so callers must exclude the term rather than substitute a placeholder.
  score01: number | null;
}

function judgeProbe(
  rationaleId: string,
  response: ResponseType,
): { verdict: CoherenceVerdict; note: string } {
  if (rationaleId === 'firmness') {
    return ordinal(response) >= ordinal('MATCH')
      ? { verdict: 'CONSISTENT', note: 'Firmness claimed, firmness delivered.' }
      : { verdict: 'MISMATCH', note: 'Claimed firmness prevents salami-slicing, then gave ground.' };
  }
  if (rationaleId === 'restraint') {
    return ordinal(response) <= ordinal('PROTEST')
      ? { verdict: 'CONSISTENT', note: 'Restraint claimed, escalation avoided.' }
      : { verdict: 'MISMATCH', note: 'Claimed restraint avoids a pretext, then escalated.' };
  }
  if (rationaleId === 'proportionate') {
    return response === 'CONCEDE' || response === 'ESCALATE'
      ? { verdict: 'MISMATCH', note: 'Claimed proportionality, then chose an off-ladder rung.' }
      : { verdict: 'CONSISTENT', note: 'Response sat on the proportionate rung.' };
  }
  return { verdict: 'UNSCORED', note: 'No coherence rule for this rationale.' };
}

const TRACK_FOR_RATIONALE: Record<string, string> = {
  denial: 'denial',
  cost: 'punishment',
  hedge: 'intelligence',
};

function judgePurchase(
  rationaleId: string,
  cardId: string,
  turn: number,
  state: GameState,
  content: ContentPack,
): { verdict: CoherenceVerdict; note: string } {
  const card = content.cardsById[cardId];
  if (!card) return { verdict: 'UNSCORED', note: 'Unknown card.' };

  if (card.family === 'TRACK_LEVEL') {
    // Readiness shortens every lead time, so it serves any stated purpose.
    const expected = card.track === 'readiness' ? undefined : TRACK_FOR_RATIONALE[rationaleId];
    if (!expected) {
      return { verdict: 'UNSCORED', note: 'Enabling investment; consistent with any purpose.' };
    }
    return card.track === expected
      ? { verdict: 'CONSISTENT', note: `Bought ${expected} capability, as stated.` }
      : {
          verdict: 'MISMATCH',
          note: `Stated a ${expected} purpose but bought ${card.track ?? 'another'} capability.`,
        };
  }

  if (rationaleId === 'deter') {
    return card.signalType === 'CHEAP'
      ? { verdict: 'MISMATCH', note: 'Deterrence by cheap talk: the Rival discounts it.' }
      : { verdict: 'CONSISTENT', note: 'Costly signal backed the deterrent claim.' };
  }
  if (rationaleId === 'reputation') {
    return card.commitmentSpec
      ? { verdict: 'CONSISTENT', note: 'Put a commitment on the register, as claimed.' }
      : { verdict: 'MISMATCH', note: 'Invoked commitment reputation without committing to anything.' };
  }
  if (rationaleId === 'spiral' || rationaleId === 'channel') {
    const offensiveSameTurn = state.player.signalHistory.some(
      (s) => s.turn === turn && s.offensiveCoded,
    );
    return offensiveSameTurn
      ? { verdict: 'MISMATCH', note: 'Signalled limited aims in the same quarter as an offensive move.' }
      : { verdict: 'CONSISTENT', note: 'Reassurance sent without a contradicting move.' };
  }
  if (rationaleId === 'domestic') {
    return { verdict: 'CONSISTENT', note: 'Any visible move serves a domestic audience.' };
  }
  return { verdict: 'UNSCORED', note: 'No coherence rule for this rationale.' };
}

function rationaleLabel(rationaleId: string, content: ContentPack): string {
  for (const set of content.rationales) {
    const opt = set.options.find((o) => o.id === rationaleId);
    if (opt) return opt.label;
  }
  return rationaleId;
}

// Audit every justified decision: what was said vs. what was done.
export function coherenceAudit(state: GameState, content: ContentPack): CoherenceReport {
  const rows: CoherenceRow[] = [];

  for (const d of state.analytics.decisions) {
    if (d.kind !== 'PROBE_RESPONSE' && d.kind !== 'SIGNAL' && d.kind !== 'INVESTMENT') continue;
    const stated = d.rationaleId ? rationaleLabel(d.rationaleId, content) : '—';

    if (!d.rationaleId || d.rationaleId === 'auto') {
      rows.push({
        turn: d.turn,
        kind: d.kind,
        refId: d.refId,
        action: actionLabel(d, state, content),
        stated,
        verdict: 'UNSCORED',
        note: 'No rationale recorded.',
      });
      continue;
    }

    let judged: { verdict: CoherenceVerdict; note: string };
    if (d.kind === 'PROBE_RESPONSE') {
      const probe = state.world.probeLog.find((p) => p.turn === d.turn && p.probeId === d.refId);
      judged = probe
        ? judgeProbe(d.rationaleId, probe.responseType)
        : { verdict: 'UNSCORED', note: 'No probe outcome recorded.' };
    } else {
      judged = judgePurchase(d.rationaleId, d.refId, d.turn, state, content);
    }

    rows.push({
      turn: d.turn,
      kind: d.kind,
      refId: d.refId,
      action: actionLabel(d, state, content),
      stated,
      verdict: judged.verdict,
      note: judged.note,
    });
  }

  const scored = rows.filter((r) => r.verdict !== 'UNSCORED').length;
  const mismatches = rows.filter((r) => r.verdict === 'MISMATCH').length;
  const score01 = scored === 0 ? null : clamp((scored - mismatches) / scored, 0, 1);
  return { rows, scored, mismatches, score01 };
}

function actionLabel(d: DecisionRecord, state: GameState, content: ContentPack): string {
  if (d.kind === 'PROBE_RESPONSE') {
    const probe = state.world.probeLog.find((p) => p.turn === d.turn && p.probeId === d.refId);
    const title = content.probes.find((p) => p.id === d.refId)?.title ?? d.refId;
    return probe ? `${title} — ${probe.responseType}` : title;
  }
  return content.cardsById[d.refId]?.title ?? d.refId;
}
