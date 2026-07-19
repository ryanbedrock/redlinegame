// ============================================================================
// Content validation + ContentPack assembly (PRD §7, §9.4, AC-3).
//
// Runs Ajv (draft 2020-12) structural validation over every content file, then
// the Condition-DSL validator over every embedded expression, then referential-
// integrity and closed-vocabulary checks. Build fails loudly on invalid
// content. Shared by the browser loader and the node validate script.
// ============================================================================

import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { validateCondition } from '../engine/conditions';
import { STOCK_TARGETS, MULTIPLIER_FLOW_TARGETS } from '../engine/effects';
import type { EffectSpec } from '../engine/types';
import {
  RESPONSE_ORDINAL,
  RIVAL_TYPES,
  SIGNAL_CLASSES,
  TRACK_IDS,
  VOICE_IDS,
  type Card,
  type ContentPack,
  type DiagnosisContent,
  type EpiloguePack,
  type EventCard,
  type InboxTemplate,
  type IntelTemplate,
  type PolicyProfile,
  type ProbeCard,
  type QuizItem,
  type RationaleSet,
  type RivalRule,
  type RivalType,
  type RivalTypeDef,
  type Scenario,
} from '../engine/types';

export interface RawFiles {
  scenario: unknown;
  signals: unknown;
  investments: unknown;
  probes: unknown;
  rivalTypes: unknown;
  rivalRules: unknown;
  events: unknown;
  inbox: unknown;
  intelTemplates: unknown;
  diagnosis: unknown;
  rationales: unknown;
  epilogue: unknown;
  policies: unknown;
  quiz: unknown;
}

export type SchemaMap = Record<string, object>;

const FILE_TO_SCHEMA: Record<keyof RawFiles, string> = {
  scenario: 'scenario',
  signals: 'cards',
  investments: 'cards',
  probes: 'probes',
  rivalTypes: 'rival_types',
  rivalRules: 'rival_rules',
  events: 'events',
  inbox: 'inbox',
  intelTemplates: 'intel_templates',
  diagnosis: 'diagnosis',
  rationales: 'rationales',
  epilogue: 'epilogue',
  policies: 'policies',
  quiz: 'quiz',
};

const VALID_EFFECT_TARGETS = new Set([
  'budget',
  'budgetIncome',
  'politicalCapital',
  'statusQuoIntegrity',
  'perceivedResolve',
  'perceivedCapability',
  'threatPerception',
  'internalPressure',
  'armingLevel',
  'playerDistractionActive',
  'audienceCostMultiplier',
  'intelCollectionBoost',
]);

export class ContentValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Content validation failed:\n - ${errors.join('\n - ')}`);
    this.name = 'ContentValidationError';
  }
}

export function assembleContentPack(files: RawFiles, schemas: SchemaMap): ContentPack {
  const errors: string[] = [];
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validators: Partial<Record<string, ValidateFunction>> = {};
  for (const [id, schema] of Object.entries(schemas)) {
    validators[id] = ajv.compile(schema);
  }

  // 1. Structural (Ajv).
  for (const key of Object.keys(FILE_TO_SCHEMA) as (keyof RawFiles)[]) {
    const v = validators[FILE_TO_SCHEMA[key]];
    if (!v) {
      errors.push(`Missing schema for ${FILE_TO_SCHEMA[key]}`);
      continue;
    }
    if (!v(files[key])) {
      for (const e of v.errors ?? []) errors.push(`${key}${e.instancePath} ${e.message ?? ''}`);
    }
  }
  if (errors.length) throw new ContentValidationError(errors);

  const scenario = files.scenario as Scenario;
  const signals = files.signals as Card[];
  const investments = files.investments as Card[];
  const probes = files.probes as ProbeCard[];
  const rivalTypesArr = files.rivalTypes as RivalTypeDef[];
  const rivalRules = files.rivalRules as RivalRule[];
  const events = files.events as EventCard[];
  const inbox = files.inbox as InboxTemplate[];
  const intelTemplates = files.intelTemplates as IntelTemplate[];
  const diagnosis = files.diagnosis as DiagnosisContent;
  const rationales = files.rationales as RationaleSet[];
  const epilogue = files.epilogue as EpiloguePack;
  const policies = files.policies as PolicyProfile[];
  const quiz = files.quiz as QuizItem[];

  const push = (m: string) => errors.push(m);

  // Reference sets.
  const cards = [...signals, ...investments];
  const cardIds = new Set(cards.map((c) => c.id));
  const probeIds = new Set(probes.map((p) => p.id));
  const rationaleIds = new Set(rationales.map((r) => r.id));
  const rivalTypes = {} as Record<RivalType, RivalTypeDef>;
  for (const t of RIVAL_TYPES) {
    const def = rivalTypesArr.find((d) => d.type === t);
    if (!def) push(`rivalTypes: missing definition for ${t}`);
    else rivalTypes[t] = def;
  }

  // 2. DSL conditions (RIVAL/PLAYER contexts).
  const checkCond = (expr: unknown, where: string, ctx: 'RIVAL_CONTEXT' | 'PLAYER_CONTEXT') => {
    try {
      validateCondition(expr, where, ctx);
    } catch (e) {
      push((e as Error).message);
    }
  };
  rivalRules.forEach((r) => checkCond(r.condition, `rivalRules[${r.id}].condition`, 'RIVAL_CONTEXT'));
  events.forEach((e) => {
    if (e.condition) checkCond(e.condition, `events[${e.id}].condition`, 'RIVAL_CONTEXT');
  });
  inbox.forEach((m) => {
    if (m.condition) checkCond(m.condition, `inbox[${m.id}].condition`, 'RIVAL_CONTEXT');
  });
  cards.forEach((c) => {
    if (c.availability) checkCond(c.availability, `card[${c.id}].availability`, 'PLAYER_CONTEXT');
  });
  policies.forEach((p) => {
    (p.probeResponse.rules ?? []).forEach((r, i) =>
      checkCond(r.condition, `policies[${p.id}].probeResponse.rules[${i}]`, 'PLAYER_CONTEXT'),
    );
    p.purchasePlan.buys.forEach((b, i) => {
      if (b.condition) checkCond(b.condition, `policies[${p.id}].purchasePlan.buys[${i}]`, 'PLAYER_CONTEXT');
    });
  });

  // 3. Effect target vocabulary + shape (reject inert effect shapes, §1.4).
  const checkEffects = (effs: EffectSpec[] | undefined, where: string) => {
    (effs ?? []).forEach((e, i) => {
      if (!VALID_EFFECT_TARGETS.has(e.target)) {
        push(`${where}[${i}]: unknown effect target "${e.target}"`);
        return;
      }
      // A stock mutates immediately; `durationTurns` has no consumer and would
      // silently orphan a modifier that never applies.
      if (STOCK_TARGETS.has(e.target) && e.durationTurns !== undefined) {
        push(`${where}[${i}]: durationTurns is inert on stock target "${e.target}"`);
      }
      // Multiplier flow targets are read only via `mul`; an add/set is inert.
      if (MULTIPLIER_FLOW_TARGETS.has(e.target) && e.op !== 'mul') {
        push(`${where}[${i}]: "${e.target}" is read multiplicatively — op must be "mul", not "${e.op}"`);
      }
    });
  };
  events.forEach((e) => {
    checkEffects(e.effects, `events[${e.id}].effects`);
    for (const t of Object.keys(e.perTypeEffects ?? {})) {
      checkEffects(e.perTypeEffects?.[t as RivalType], `events[${e.id}].perTypeEffects[${t}]`);
    }
  });
  inbox.forEach((m) =>
    (m.responseOptions ?? []).forEach((o) => checkEffects(o.effects, `inbox[${m.id}].responseOptions[${o.id}]`)),
  );

  // Closed vocabulary: inbox voiceIds must be declared VoiceId values.
  inbox.forEach((m) => {
    if (!VOICE_IDS.includes(m.voiceId)) push(`inbox[${m.id}]: unknown voiceId "${m.voiceId}"`);
  });

  // 4. Referential integrity + closed vocabulary.
  cards.forEach((c) => {
    if (!rationaleIds.has(c.rationaleSetId)) push(`card[${c.id}]: unknown rationaleSet ${c.rationaleSetId}`);
    if (c.family === 'TRACK_LEVEL') {
      if (!c.track || !TRACK_IDS.includes(c.track)) push(`card[${c.id}]: TRACK_LEVEL needs a valid track`);
    }
    if (c.family === 'SIGNAL' && c.signalType && !SIGNAL_CLASSES.includes(c.signalType)) {
      push(`card[${c.id}]: unknown signalType ${c.signalType}`);
    }
  });
  probes.forEach((p) =>
    p.responses.forEach((r) => {
      if (!(r.responseType in RESPONSE_ORDINAL)) push(`probes[${p.id}]: unknown responseType ${r.responseType}`);
      if (!rationaleIds.has(r.rationaleSetId)) push(`probes[${p.id}].${r.id}: unknown rationaleSet ${r.rationaleSetId}`);
    }),
  );
  rivalRules.forEach((r) => {
    if (r.kind === 'PROBE' && (!r.probeId || !probeIds.has(r.probeId))) {
      push(`rivalRules[${r.id}]: unknown probeId ${r.probeId}`);
    }
    if (!RIVAL_TYPES.includes(r.type)) push(`rivalRules[${r.id}]: unknown type ${r.type}`);
  });
  policies.forEach((p) =>
    p.purchasePlan.buys.forEach((b) => {
      if (!cardIds.has(b.cardId)) push(`policies[${p.id}]: unknown card ${b.cardId}`);
    }),
  );
  scenario.beats.forEach((b) => {
    if (!events.some((e) => e.id === b.eventId)) push(`scenario.beats: unknown event ${b.eventId}`);
    if (b.minTurn > b.maxTurn) push(`scenario.beats[${b.eventId}]: minTurn ${b.minTurn} > maxTurn ${b.maxTurn}`);
  });
  // scenario.beats is authoritative for event timing; an event must not carry
  // its own window (guards against a stale schedule silently diverging).
  events.forEach((e) => {
    if ('schedule' in e) push(`events[${e.id}]: 'schedule' is not allowed — scheduling is defined by scenario.beats`);
    // A deterministic event with no beat and no condition can never fire.
    const scheduled = scenario.beats.some((b) => b.eventId === e.id);
    if (!scheduled && !e.condition) {
      push(`events[${e.id}]: unreachable — not referenced by scenario.beats and has no condition`);
    }
  });
  for (const t of TRACK_IDS) {
    if (scenario.opening.tracks[t] === undefined) push(`scenario.opening.tracks: missing ${t}`);
    if (scenario.tuning.trackThreatDeltas[t] === undefined) push(`scenario.tuning.trackThreatDeltas: missing ${t}`);
  }
  (scenario.seedTypePins ?? []).forEach((p) => {
    if (!RIVAL_TYPES.includes(p.type)) push(`scenario.seedTypePins: unknown type ${p.type}`);
  });
  RIVAL_TYPES.forEach((t) => {
    if (!diagnosis.typeDescriptions[t]) push(`diagnosis.typeDescriptions: missing ${t}`);
    if (!diagnosis.tellSheets[t]) push(`diagnosis.tellSheets: missing ${t}`);
  });
  if (epilogue.decisions.length < 4) push(`epilogue: expected 4 war-epilogue decisions, got ${epilogue.decisions.length}`);
  quiz.forEach((q) => {
    if (!q.options.some((o) => o.correct)) push(`quiz[${q.id}]: no correct option`);
  });

  if (errors.length) throw new ContentValidationError(errors);

  const cardsById: Record<string, Card> = {};
  for (const c of cards) cardsById[c.id] = c;

  const pack: ContentPack = {
    scenario,
    signals,
    investments,
    probes,
    rivalTypes,
    rivalRules,
    events,
    inbox,
    intelTemplates,
    diagnosis,
    rationales,
    epilogue,
    policies,
    quiz,
    cardsById,
  };
  return deepFreeze(pack);
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.values(obj).forEach((v) => deepFreeze(v));
    Object.freeze(obj);
  }
  return obj;
}
