// ============================================================================
// Turn resolver — pure function (PRD §6.5). resolveTurn(state, decisions,
// content) → new GameState. Eleven ordered resolution phases. Determinism and
// purity are enforced by AC-1/AC-2/AC-9. No Date, no Math.random, no I/O.
// ============================================================================

import type {
  Card,
  Commitment,
  ContentPack,
  EventCard,
  GameState,
  InboxMessage,
  InboxTemplate,
  IntelEstimate,
  IntelMetric,
  ProbeCard,
  ProbeRecord,
  SignalRecord,
  TrackId,
  TurnDecisions,
  TurnRecord,
} from './types';
import { RESPONSE_ORDINAL, TRACK_IDS } from './types';
import { buildRivalVars } from './context';
import { evalBool } from './conditions';
import {
  clamp,
  clamp01,
  credibilityMultiplier,
  effectiveBackDowns as effBackDowns,
  intelSigma,
  probeDefaultEffects,
} from './formulas';
import {
  applyEffects,
  expireModifiers,
  flagActive,
  flowMultiplier,
} from './effects';
import { advanceRivalInternal, evaluateDecision, generateProbe } from './rival';
import { noiseAdditive } from './rng';

const INTEL_METRICS: IntelMetric[] = [
  'RESOLVE_READ',
  'CAPABILITY_READ',
  'INTENT_ASSESSMENT',
  'ARMING_READ',
];

function deepClone(state: GameState): GameState {
  return structuredClone(state);
}

// --- Phase 1: probe response ------------------------------------------------

function phaseProbeResponse(
  next: GameState,
  decisions: TurnDecisions,
  content: ContentPack,
): { probeId?: string } {
  const stagedId = next.world.stagedProbeId;
  if (!stagedId) return {};
  const probe = content.probes.find((p) => p.id === stagedId);
  if (!probe) return {};

  const streakBefore = next.world.concessionStreak;
  const escalated = streakBefore >= content.scenario.tuning.concessionSalamiThreshold;
  const severity = escalated ? probe.severity + 1 : probe.severity;
  const salamiValue = escalated ? probe.salamiValue * 1.5 : probe.salamiValue;

  // Determine the chosen response; inaction (no matching option) = CONCEDE.
  const chosen = decisions.probeResponse;
  let responseType = chosen?.responseType ?? 'CONCEDE';
  let responseChosen: string | null = null;
  let overrideOpt: ProbeCard['responses'][number] | undefined;
  if (chosen && chosen.probeId === stagedId) {
    // Decisions carry a responseType directly; find the option matching it so
    // per-response overrides (if authored) can apply.
    overrideOpt = probe.responses.find((r) => r.responseType === chosen.responseType);
    responseChosen = overrideOpt?.id ?? null;
    responseType = chosen.responseType;
  }

  const eff = probeDefaultEffects(responseType, salamiValue);
  const ov = overrideOpt?.overrides;
  const sqDelta = ov?.statusQuoDelta ?? eff.statusQuoDelta;
  const resolveDelta = ov?.perceivedResolveDelta ?? eff.perceivedResolveDelta;
  const tpDelta = ov?.threatPerceptionDelta ?? eff.threatPerceptionDelta;

  next.world.statusQuoIntegrity = clamp(
    next.world.statusQuoIntegrity + sqDelta,
    0,
    100,
  );
  next.rival.perceivedResolve = clamp01(next.rival.perceivedResolve + resolveDelta);
  next.rival.threatPerception = clamp01(next.rival.threatPerception + tpDelta);
  next.world.concessionStreak =
    eff.concessionStreakOp === 'inc' ? streakBefore + 1 : 0;

  // Commitment lifecycle.
  const floorMet = (floor: string) =>
    RESPONSE_ORDINAL[responseType] >= RESPONSE_ORDINAL[floor as keyof typeof RESPONSE_ORDINAL];
  const audienceMult = flowMultiplier(next, 'audienceCostMultiplier', next.meta.turnNumber);
  for (const c of next.player.commitmentRegister) {
    if (c.status === 'BROKEN') continue;
    const covers = c.scopeProbeTags.some((tag) => probe.tags.includes(tag));
    if (!covers) continue;
    if (floorMet(c.floorResponse)) {
      c.timesTested += 1;
      c.timesHonored += 1;
      c.status = 'HONORED';
      next.player.honoredTestCount += 1;
      next.player.politicalCapital = clamp(
        next.player.politicalCapital + content.scenario.tuning.honoredTestPC,
        0,
        content.scenario.tuning.pcCap,
      );
    } else {
      c.timesTested += 1;
      c.status = 'BROKEN';
      next.player.backDownCount += 1;
      next.player.politicalCapital = clamp(
        next.player.politicalCapital - c.backDownPenaltyPC * audienceMult,
        0,
        content.scenario.tuning.pcCap,
      );
    }
  }

  const record: ProbeRecord = {
    turn: next.meta.turnNumber,
    probeId: stagedId,
    severity,
    salamiValue,
    responseChosen,
    responseType,
    statusQuoDelta: sqDelta,
  };
  next.world.probeLog.push(record);
  next.analytics.decisions.push({
    turn: next.meta.turnNumber,
    kind: 'PROBE_RESPONSE',
    refId: stagedId,
    cost: { budget: 0, politicalCapital: 0 },
    rationaleId: chosen?.rationaleId,
  });
  next.world.stagedProbeId = null;
  return { probeId: stagedId };
}

// --- Phase 2: signals & investments -----------------------------------------

interface AppliedSignal {
  card: Card;
}

function phaseSignalsInvestments(
  next: GameState,
  decisions: TurnDecisions,
  content: ContentPack,
): AppliedSignal[] {
  const applied: AppliedSignal[] = [];
  for (const purchase of decisions.purchases) {
    const card = content.cardsById[purchase.cardId];
    if (!card) continue;
    // Affordability & purchase-limit guards (defensive; UI also enforces).
    if (card.cost.budget > next.player.budget) continue;
    if (card.cost.politicalCapital > next.player.politicalCapital) continue;
    const count = next.player.purchaseCounts[card.id] ?? 0;
    if (card.maxPurchases !== undefined && count >= card.maxPurchases) continue;
    const last = next.player.lastPurchaseTurn[card.id];
    if (
      card.cooldownTurns !== undefined &&
      last !== undefined &&
      next.meta.turnNumber - last < card.cooldownTurns
    ) {
      continue;
    }

    next.player.budget = Math.max(0, next.player.budget - card.cost.budget);
    next.player.politicalCapital = clamp(
      next.player.politicalCapital - card.cost.politicalCapital,
      0,
      content.scenario.tuning.pcCap,
    );
    next.player.purchaseCounts[card.id] = count + 1;
    next.player.lastPurchaseTurn[card.id] = next.meta.turnNumber;
    next.analytics.cumulativeSpend += card.cost.budget + card.cost.politicalCapital;

    if (card.family === 'SIGNAL') {
      const rec: SignalRecord = {
        turn: next.meta.turnNumber,
        cardId: card.id,
        type: card.signalType ?? 'CHEAP',
        cost: card.cost,
        rationaleId: purchase.rationaleId,
        offensiveCoded: card.offensiveCoded ?? false,
      };
      next.player.signalHistory.push(rec);
      // Register commitment (TIED_HANDS with commitmentSpec).
      if (card.commitmentSpec) {
        const commitment: Commitment = {
          id: `${card.id}@${next.meta.turnNumber}`,
          cardId: card.id,
          declaredOnTurn: next.meta.turnNumber,
          scopeProbeTags: card.commitmentSpec.scopeProbeTags,
          floorResponse: card.commitmentSpec.floorResponse,
          backDownPenaltyPC: card.commitmentSpec.backDownPenaltyPC,
          upkeepPC: card.commitmentSpec.upkeepPC,
          timesTested: 0,
          timesHonored: 0,
          status: 'STANDING',
        };
        next.player.commitmentRegister.push(commitment);
      }
      applied.push({ card });
      next.analytics.decisions.push({
        turn: next.meta.turnNumber,
        kind: 'SIGNAL',
        refId: card.id,
        cost: card.cost,
        rationaleId: purchase.rationaleId,
      });
    } else {
      // TRACK_LEVEL: queue with lead time, reduced by readiness.
      const readinessBonus =
        next.player.tracks.readiness *
        content.scenario.tuning.trackLeadTimeReadinessBonus;
      const lead = Math.max(1, Math.round(card.leadTimeTurns - readinessBonus));
      next.player.pendingInvestments.push({
        trackOrSignalId: card.id,
        turnsRemaining: lead,
      });
      next.analytics.decisions.push({
        turn: next.meta.turnNumber,
        kind: 'INVESTMENT',
        refId: card.id,
        cost: card.cost,
        rationaleId: purchase.rationaleId,
      });
    }
  }

  // Standing-commitment upkeep (per-turn PC).
  for (const c of next.player.commitmentRegister) {
    if (c.status === 'STANDING' || c.status === 'HONORED') {
      next.player.politicalCapital = clamp(
        next.player.politicalCapital - c.upkeepPC,
        0,
        content.scenario.tuning.pcCap,
      );
    }
  }

  return applied;
}

// --- Phase 3: advance pipelines ---------------------------------------------

function phaseAdvancePipelines(next: GameState, content: ContentPack): TrackId[] {
  const completed: TrackId[] = [];
  const remaining: GameState['player']['pendingInvestments'] = [];
  for (const inv of next.player.pendingInvestments) {
    const turnsRemaining = inv.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      const card = content.cardsById[inv.trackOrSignalId];
      if (card && card.family === 'TRACK_LEVEL' && card.track) {
        // Set the track to the card's target level (levels are ordered).
        const target = card.level ?? next.player.tracks[card.track] + 1;
        next.player.tracks[card.track] = clamp(
          Math.max(next.player.tracks[card.track], target),
          0,
          10,
        );
        completed.push(card.track);
      }
    } else {
      remaining.push({ ...inv, turnsRemaining });
    }
  }
  next.player.pendingInvestments = remaining;
  return completed;
}

// --- Phase 4: update Rival perception ledgers -------------------------------

function phasePerception(
  next: GameState,
  content: ContentPack,
  applied: AppliedSignal[],
  completedTracks: TrackId[],
  denialAtStart: number,
  punishmentAtStart: number,
): void {
  const def = content.rivalTypes[next.rival.type];
  const eff = effBackDowns(next.player.backDownCount, next.player.honoredTestCount);

  for (const { card } of applied) {
    const cls = card.signalType ?? 'CHEAP';
    const w = def.weights[cls];
    const m = credibilityMultiplier(cls, eff);
    const base = card.baseValue ?? 0;
    next.rival.perceivedResolve = clamp01(next.rival.perceivedResolve + w * m * base);
    if (card.tpDelta) {
      next.rival.threatPerception = clamp01(next.rival.threatPerception + card.tpDelta);
    }
  }

  // Completed track levels apply their per-track threatPerception deltas.
  for (const track of completedTracks) {
    const delta = content.scenario.tuning.trackThreatDeltas[track] ?? 0;
    if (delta) next.rival.threatPerception = clamp01(next.rival.threatPerception + delta);
  }

  // perceivedCapability tracks realized denial/punishment with a 1-turn lag.
  const capTarget = clamp01((denialAtStart + punishmentAtStart) / 20);
  next.rival.perceivedCapability = clamp01(
    next.rival.perceivedCapability + (capTarget - next.rival.perceivedCapability) * 0.5,
  );

  // Per-turn decay toward priors (recency dominance, T8).
  const d = content.scenario.tuning.decayPerTurn;
  next.rival.perceivedResolve = clamp01(
    next.rival.perceivedResolve + (def.priorResolve - next.rival.perceivedResolve) * d,
  );
  next.rival.perceivedCapability = clamp01(
    next.rival.perceivedCapability + (def.priorCapability - next.rival.perceivedCapability) * d,
  );
  next.rival.threatPerception = clamp01(
    next.rival.threatPerception + (def.priorThreatPerception - next.rival.threatPerception) * d,
  );
}

// --- Phase 8: events --------------------------------------------------------

function eventFireCount(next: GameState, eventId: string): number {
  return next.world.eventLog.filter((e) => e.eventId === eventId).length;
}

function eventLastTurn(next: GameState, eventId: string): number | undefined {
  const fires = next.world.eventLog.filter((e) => e.eventId === eventId);
  return fires.length ? fires[fires.length - 1].turn : undefined;
}

function phaseEvents(next: GameState, content: ContentPack): string[] {
  const fired: string[] = [];
  const vars = buildRivalVars(next, content);
  const turn = next.meta.turnNumber;

  const candidates: EventCard[] = content.events.filter((ev) => {
    if (ev.maxFires !== undefined && eventFireCount(next, ev.id) >= ev.maxFires) {
      return false;
    }
    const last = eventLastTurn(next, ev.id);
    if (ev.cooldownTurns !== undefined && last !== undefined && turn - last < ev.cooldownTurns) {
      return false;
    }
    if (ev.schedule) {
      if (turn < ev.schedule.minTurn || turn > ev.schedule.maxTurn) return false;
    }
    if (ev.condition && !evalBool(ev.condition, vars)) return false;
    // Scheduled events with a window fire as soon as in-window (once).
    if (!ev.schedule && !ev.condition) return false;
    return true;
  });

  // Deterministic ordering; ≤2 per turn.
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  for (const ev of candidates.slice(0, 2)) {
    const effects = ev.perTypeEffects?.[next.rival.type] ?? ev.effects;
    applyEffects(next, effects, ev.id, turn);
    if (ev.biasMetric) {
      next.world.biasActive = {
        metric: ev.biasMetric,
        amount: ev.biasAmount ?? 0,
        expiresOnTurn: turn + (ev.biasDurationTurns ?? 3),
      };
    }
    // Distraction flag from a third-party crisis effect is set via effects
    // targeting playerDistractionActive; recompute below.
    next.world.eventLog.push({
      turn,
      eventId: ev.id,
      effects,
      expiresOnTurn: effects.find((e) => e.durationTurns)?.durationTurns
        ? turn + Math.max(...effects.map((e) => e.durationTurns ?? 0))
        : undefined,
    });
    fired.push(ev.id);
  }

  next.world.playerDistractionActive = flagActive(next, 'playerDistractionActive', turn);
  return fired;
}

// --- Phase 9: intelligence --------------------------------------------------

function truthForMetric(next: GameState, metric: IntelMetric): number {
  switch (metric) {
    case 'RESOLVE_READ':
      return next.rival.perceivedResolve;
    case 'CAPABILITY_READ':
      return next.rival.perceivedCapability;
    case 'INTENT_ASSESSMENT':
      return clamp01(next.rival.warUtility);
    case 'ARMING_READ':
      return next.rival.armingLevel / 10;
  }
}

function confidenceFor(sigma: number): 'LOW' | 'MODERATE' | 'HIGH' {
  if (sigma >= 0.18) return 'LOW';
  if (sigma >= 0.1) return 'MODERATE';
  return 'HIGH';
}

function phaseIntel(next: GameState, content: ContentPack): void {
  const turn = next.meta.turnNumber;
  const sigma = intelSigma(
    next.player.tracks.intelligence,
    content.scenario.tuning.intelSigmaLevel0,
    content.scenario.tuning.intelSigmaLevel10,
  );
  const bias = next.world.biasActive;
  for (const metric of INTEL_METRICS) {
    const truth = truthForMetric(next, metric);
    const n = noiseAdditive(next.meta.seed, next.rng, 'intel', sigma);
    const biasAmt = bias && bias.metric === metric && bias.expiresOnTurn > turn ? bias.amount : 0;
    const value = clamp01(truth + n + biasAmt);
    const template = content.intelTemplates.find(
      (t) => t.metric === metric && t.confidence === confidenceFor(sigma),
    );
    const est: IntelEstimate = {
      turn,
      metric,
      value,
      confidence: confidenceFor(sigma),
      sourceFlavorId: template?.id ?? `${metric}_default`,
    };
    next.world.intel.push(est);
  }
  if (bias && bias.expiresOnTurn <= turn) next.world.biasActive = null;
}

// --- Phase 11: correspondence + inbox selection -----------------------------

function phaseCorrespondence(next: GameState, content: ContentPack): void {
  const turn = next.meta.turnNumber;
  const vars = buildRivalVars(next, content);
  const scored: { tmpl: InboxTemplate }[] = [];
  for (const tmpl of content.inbox) {
    if (tmpl.perType && tmpl.perType !== next.rival.type) continue;
    if (tmpl.maxFires !== undefined) {
      const fires = next.world.inbox.filter((m) => m.templateId === tmpl.id).length;
      if (fires >= tmpl.maxFires) continue;
    }
    if (tmpl.cooldownTurns !== undefined) {
      const last = [...next.world.inbox].reverse().find((m) => m.templateId === tmpl.id);
      if (last && turn - last.turn < tmpl.cooldownTurns) continue;
    }
    if (tmpl.condition && !evalBool(tmpl.condition, vars)) continue;
    scored.push({ tmpl });
  }
  scored.sort((a, b) => b.tmpl.priority - a.tmpl.priority || a.tmpl.id.localeCompare(b.tmpl.id));
  for (const { tmpl } of scored.slice(0, 4)) {
    const msg: InboxMessage = {
      id: `${tmpl.id}@${turn}`,
      turn,
      voiceId: tmpl.voiceId,
      templateId: tmpl.id,
      subject: tmpl.subject,
      body: tmpl.body,
      responseOptions: tmpl.responseOptions,
      read: false,
    };
    next.world.inbox.push(msg);
  }
}

// --- Main resolver ----------------------------------------------------------

export function resolveTurn(
  state: GameState,
  decisions: TurnDecisions,
  content: ContentPack,
): GameState {
  const next = deepClone(state);
  const turn = next.meta.turnNumber;

  expireModifiers(next, turn);

  const denialAtStart = next.player.tracks.denial;
  const punishmentAtStart = next.player.tracks.punishment;
  const budgetBefore = next.player.budget;
  const pcBefore = next.player.politicalCapital;
  const sqBefore = next.world.statusQuoIntegrity;
  const tracksBefore = { ...next.player.tracks };

  // 1. Probe response.
  const { probeId } = phaseProbeResponse(next, decisions, content);

  // Inbox responses (apply chosen option effects; record).
  if (decisions.inboxResponses) {
    for (const resp of decisions.inboxResponses) {
      const msg = next.world.inbox.find((m) => m.id === resp.messageId);
      if (!msg || !msg.responseOptions) continue;
      const opt = msg.responseOptions.find((o) => o.id === resp.optionId);
      if (!opt) continue;
      msg.respondedWith = opt.id;
      if (opt.effects) applyEffects(next, opt.effects, msg.id, turn);
      next.analytics.decisions.push({
        turn,
        kind: 'INBOX',
        refId: resp.messageId,
        cost: { budget: 0, politicalCapital: 0 },
      });
    }
  }

  // 2. Signals & investments.
  const applied = phaseSignalsInvestments(next, decisions, content);

  // 3. Advance pipelines.
  const completedTracks = phaseAdvancePipelines(next, content);

  // 4. Update Rival perception ledgers.
  phasePerception(next, content, applied, completedTracks, denialAtStart, punishmentAtStart);

  // 5. Advance Rival internal state.
  advanceRivalInternal(next, content);

  // 6. Evaluate Rival decision function (may set WAR).
  evaluateDecision(next, content);

  // 8. Draw events (applies to this turn's state, shown in the Resolution
  //    summary). Phases 7/9/11 that stage the NEXT quarter run after the turn
  //    advances, so their content is labelled with the upcoming turn number.
  const eventIds = phaseEvents(next, content);

  // 10. Type-belief checkpoint (record stated belief if provided).
  if (decisions.typeBelief) {
    next.analytics.typeBeliefs.push({
      turn,
      statedType: decisions.typeBelief.statedType,
    });
    next.analytics.decisions.push({
      turn,
      kind: 'TYPE_BELIEF',
      refId: decisions.typeBelief.statedType,
      cost: { budget: 0, politicalCapital: 0 },
    });
  }

  next.analytics.perceptionHistory.push({
    turn,
    perceivedCapability: next.rival.perceivedCapability,
    perceivedResolve: next.rival.perceivedResolve,
    threatPerception: next.rival.threatPerception,
    warUtility: next.rival.warUtility,
    internalPressure: next.rival.internalPressure,
  });

  // CAPITULATION check (skipped if WAR set this turn — WAR precedence).
  if (next.meta.ending !== 'WAR' && next.world.statusQuoIntegrity <= 0) {
    next.meta.ending = 'CAPITULATION';
  }

  const trackDeltas = {} as Record<TrackId, number>;
  for (const t of TRACK_IDS) trackDeltas[t] = next.player.tracks[t] - tracksBefore[t];
  const turnRecord: TurnRecord = {
    turn,
    deltas: {
      budget: next.player.budget - budgetBefore,
      politicalCapital: next.player.politicalCapital - pcBefore,
      statusQuoIntegrity: next.world.statusQuoIntegrity - sqBefore,
      tracks: trackDeltas,
    },
    probeId,
    eventIds,
    endingAfter: next.meta.ending,
    concessionStreak: next.world.concessionStreak,
  };
  next.analytics.turnRecords.push(turnRecord);

  // Advance turn / phase.
  if (next.meta.ending === 'WAR') {
    next.meta.phase = 'EPILOGUE';
    next.meta.epilogueTurn = 1;
    next.epilogue = {
      warOutcomeBase: computeWarOutcomeBase(next, content),
      decisionsTaken: [],
      finalOutcome: computeWarOutcomeBase(next, content),
    };
  } else if (next.meta.ending === 'CAPITULATION') {
    next.meta.phase = 'DEBRIEF';
  } else if (turn + 1 >= content.scenario.turnCount) {
    // Final turn reached → deterrence holds.
    next.meta.turnNumber = turn + 1;
    next.meta.ending = 'DETERRENCE_HOLD';
    next.meta.phase = 'DEBRIEF';
  } else {
    // Advance to the next quarter, apply income, then stage that quarter's
    // probe, intelligence, and correspondence (phases 7, 9, 11).
    next.meta.turnNumber = turn + 1;
    next.meta.phase = 'SITREP';
    applyTurnIncome(next, content);
    generateProbe(next, content);
    phaseIntel(next, content);
    phaseCorrespondence(next, content);
  }

  return next;
}

// Prime the opening turn (turn 0) with a staged probe, intel estimates, and
// correspondence so the first SITREP has content — "the Rival is already
// conducting low-grade probes" (§6.2). Mutates state in place; no turn advance.
export function primeInitialTurn(next: GameState, content: ContentPack): void {
  generateProbe(next, content);
  phaseIntel(next, content);
  phaseCorrespondence(next, content);
  next.analytics.perceptionHistory.push({
    turn: 0,
    perceivedCapability: next.rival.perceivedCapability,
    perceivedResolve: next.rival.perceivedResolve,
    threatPerception: next.rival.threatPerception,
    warUtility: next.rival.warUtility,
    internalPressure: next.rival.internalPressure,
  });
}

function applyTurnIncome(next: GameState, content: ContentPack): void {
  const turn = next.meta.turnNumber;
  const incomeMult = flowMultiplier(next, 'budgetIncome', turn);
  const income = next.player.budgetIncome * incomeMult;
  next.player.budget = Math.min(
    next.player.budget + income,
    next.player.budgetIncome * 1.5,
  );
  next.player.politicalCapital = Math.min(
    next.player.politicalCapital + content.scenario.tuning.pcRegenPerTurn,
    content.scenario.tuning.pcCap,
  );
}

// --- War epilogue -----------------------------------------------------------

export function computeWarOutcomeBase(next: GameState, content: ContentPack): number {
  const f = content.epilogue.outcomeFormula;
  const denial = next.player.tracks.denial;
  const readiness = next.player.tracks.readiness;
  const punishment = next.player.tracks.punishment;
  // Denial + readiness win battles; punishment contributes ≤ cap%.
  const punishmentContribution = Math.min(
    f.punishmentBattlefieldCap,
    (punishment / 10) * f.punishmentBattlefieldCap,
  );
  const base =
    f.posturebase +
    denial * f.denialWeight +
    readiness * f.readinessWeight +
    punishmentContribution;
  return clamp(base, 0, 100);
}

// Resolve one epilogue decision turn (E1..E4). Returns updated state.
export function resolveEpilogueTurn(
  state: GameState,
  decisions: TurnDecisions,
  content: ContentPack,
): GameState {
  const next = deepClone(state);
  if (!next.epilogue) return next;
  const eTurn = next.meta.epilogueTurn ?? 1;
  const decision = content.epilogue.decisions[eTurn - 1];
  if (decision && decisions.epilogueChoice) {
    const opt = decision.options.find((o) => o.id === decisions.epilogueChoice!.optionId);
    if (opt) {
      let delta = opt.outcomeDelta;
      if (opt.terminationLeverage) {
        const f = content.epilogue.outcomeFormula;
        const bonus = Math.min(
          f.terminationCap,
          Math.max(0, next.player.tracks.punishment - 3) * f.terminationPerLevelAbove3,
        );
        delta += bonus;
      }
      next.epilogue.finalOutcome = clamp(next.epilogue.finalOutcome + delta, 0, 100);
      next.epilogue.decisionsTaken.push(`${decision.id}:${opt.id}`);
      next.analytics.decisions.push({
        turn: next.meta.turnNumber,
        kind: 'EPILOGUE',
        refId: `${decision.id}:${opt.id}`,
        cost: { budget: 0, politicalCapital: 0 },
      });
    }
  }
  if (eTurn >= content.epilogue.decisions.length) {
    next.meta.phase = 'DEBRIEF';
  } else {
    next.meta.epilogueTurn = eTurn + 1;
  }
  return next;
}
