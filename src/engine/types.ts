// ============================================================================
// Normative state model, content schema types, and shared vocabulary
// (PRD §6.4, Annex A.1/A.3). Single serializable GameState; extensions only
// via meta.extensions. This module is pure (AC-2): types + const tables only.
// ============================================================================

// --- Shared vocabulary (Annex A.1) ------------------------------------------

export type RivalType =
  | 'OPPORTUNIST'
  | 'PRESSURED_EXPANSIONIST'
  | 'SECURITY_SEEKER';

export const RIVAL_TYPES: RivalType[] = [
  'OPPORTUNIST',
  'PRESSURED_EXPANSIONIST',
  'SECURITY_SEEKER',
];

export type ResponseType =
  | 'CONCEDE'
  | 'PROTEST'
  | 'MATCH'
  | 'ENFORCE'
  | 'ESCALATE';

export const RESPONSE_ORDINAL: Record<ResponseType, number> = {
  CONCEDE: 0,
  PROTEST: 1,
  MATCH: 2,
  ENFORCE: 3,
  ESCALATE: 4,
};

export type TrackId = 'denial' | 'punishment' | 'intelligence' | 'readiness';
export const TRACK_IDS: TrackId[] = [
  'denial',
  'punishment',
  'intelligence',
  'readiness',
];

export type SignalClass = 'CHEAP' | 'SUNK' | 'TIED_HANDS' | 'REASSURANCE';
export const SIGNAL_CLASSES: SignalClass[] = [
  'CHEAP',
  'SUNK',
  'TIED_HANDS',
  'REASSURANCE',
];

export type VoiceId =
  | 'INTEL_DIRECTOR'
  | 'DEFENSE_MINISTER'
  | 'FOREIGN_MINISTER'
  | 'CHIEF_OF_STAFF'
  | 'ARCHIPELAGO_PREMIER'
  | 'RIVAL_PUBLIC';

export type RngStream = 'rival' | 'probes' | 'events' | 'intel' | 'epilogue';
export const RNG_STREAMS: RngStream[] = [
  'rival',
  'probes',
  'events',
  'intel',
  'epilogue',
];

export type IntelMetric =
  | 'RESOLVE_READ'
  | 'CAPABILITY_READ'
  | 'INTENT_ASSESSMENT'
  | 'ARMING_READ';

export type Ending = 'DETERRENCE_HOLD' | 'WAR' | 'CAPITULATION';

export type Phase =
  | 'SITREP'
  | 'PROBE_RESPONSE'
  | 'SIGNALS'
  | 'RESOLUTION'
  | 'EPILOGUE'
  | 'DEBRIEF';

// --- Condition DSL (Annex A.2) ----------------------------------------------

export type ConditionLeaf = { var: string } | number | string | boolean;

export type ConditionExpr =
  | ConditionLeaf
  | { all: ConditionExpr[] }
  | { any: ConditionExpr[] }
  | { not: ConditionExpr }
  | { eq: [ConditionExpr, ConditionExpr] }
  | { neq: [ConditionExpr, ConditionExpr] }
  | { gt: [ConditionExpr, ConditionExpr] }
  | { gte: [ConditionExpr, ConditionExpr] }
  | { lt: [ConditionExpr, ConditionExpr] }
  | { lte: [ConditionExpr, ConditionExpr] }
  | { between: [ConditionExpr, ConditionExpr, ConditionExpr] }
  | { in: [ConditionExpr, (string | number)[]] }
  | { add: ConditionExpr[] }
  | { sub: [ConditionExpr, ConditionExpr] }
  | { mul: ConditionExpr[] }
  | { min: ConditionExpr[] }
  | { max: ConditionExpr[] };

export type EvalContextName = 'RIVAL_CONTEXT' | 'PLAYER_CONTEXT';

// --- Effects (Annex A.1) ----------------------------------------------------

export interface EffectSpec {
  target: string;
  op: 'add' | 'mul' | 'set';
  value: number;
  durationTurns?: number;
}

// --- Content: unified card schema (Annex A.3) -------------------------------

export interface CommitmentSpec {
  scopeProbeTags: string[];
  floorResponse: ResponseType;
  backDownPenaltyPC: number;
  upkeepPC: number;
}

export interface Card {
  id: string;
  family: 'SIGNAL' | 'TRACK_LEVEL';
  title: string;
  text: string;
  cost: { budget: number; politicalCapital: number };
  leadTimeTurns: number;
  track?: TrackId;
  level?: number;
  signalType?: SignalClass;
  baseValue?: number;
  offensiveCoded?: boolean;
  tpDelta?: number;
  commitmentSpec?: CommitmentSpec;
  availability?: ConditionExpr;
  maxPurchases?: number;
  cooldownTurns?: number;
  rationaleSetId: string;
}

// --- Content: probes --------------------------------------------------------

export interface ProbeResponseOption {
  id: string;
  label: string;
  responseType: ResponseType;
  rationaleSetId: string;
  // Optional per-response overrides of the ordinal-scale defaults (§6.3-D).
  overrides?: Partial<{
    statusQuoDelta: number; // absolute delta (else derived from salamiValue)
    perceivedResolveDelta: number;
    threatPerceptionDelta: number;
  }>;
}

export interface ProbeCard {
  id: string;
  title: string;
  text: string;
  tags: string[];
  severity: number; // 1..5
  salamiValue: number; // baseline shift when conceded
  responses: ProbeResponseOption[];
  // Per-type generation gate (RIVAL_CONTEXT). Optional; scheduling in rules.
  perType?: Partial<Record<RivalType, { weight?: number }>>;
}

// --- Content: rival types ---------------------------------------------------

export interface RivalTypeDef {
  type: RivalType;
  // Signal-class resolve-weight matrix W[type][class] (§6.5-4).
  weights: Record<SignalClass, number>;
  // Decision-function coefficients (§6.5-6).
  prize: number;
  windowBonusScale: number; // multiplies internalPressure to add to gain
  preemptionValue: number; // for SECURITY_SEEKER gain = threatPerception * this
  b: number; // cost coefficient
  warThreshold: number;
  // Threat-perception dynamics.
  priorThreatPerception: number;
  priorResolve: number;
  priorCapability: number;
  // Arming behaviour.
  baseArmingSchedule: number; // per-turn arming drift toward this level target
  armingFromThreat: number; // SECURITY_SEEKER: arming target = this * threatPerception * 10
  // Internal pressure schedule (PRESSURED_EXPANSIONIST primarily).
  pressureSchedulePerTurn: number;
  tell: string; // internal design note (debrief reveal)
}

// --- Content: rival rules (probe generation & behaviour) --------------------

export interface RivalRule {
  id: string;
  type: RivalType;
  kind: 'PROBE' | 'ARMING' | 'PRESSURE';
  condition: ConditionExpr; // RIVAL_CONTEXT
  probeId?: string; // for PROBE rules
  priority: number; // higher wins when multiple fire
  cooldownTurns?: number;
}

// --- Content: events --------------------------------------------------------

export interface EventCard {
  id: string;
  title: string;
  text: string;
  schedule?: { minTurn: number; maxTurn: number }; // scheduled window
  condition?: ConditionExpr; // RIVAL_CONTEXT triggered
  effects: EffectSpec[];
  cooldownTurns?: number;
  maxFires?: number;
  // Optional per-type divergent effects (e.g. economic shock, §6.9).
  perTypeEffects?: Partial<Record<RivalType, EffectSpec[]>>;
  // Intelligence-bias marker: metric that gets systematically overstated.
  biasMetric?: IntelMetric;
  biasAmount?: number;
  biasDurationTurns?: number;
}

// --- Content: inbox / correspondence ----------------------------------------

export interface InboxTemplate {
  id: string;
  voiceId: VoiceId;
  subject: string;
  body: string;
  condition?: ConditionExpr; // RIVAL_CONTEXT
  perType?: RivalType; // only fires for a given hidden type (Rival public voices)
  priority: number;
  cooldownTurns?: number;
  maxFires?: number;
  responseOptions?: { id: string; label: string; effects?: EffectSpec[] }[];
}

// --- Content: intel templates -----------------------------------------------

export interface IntelTemplate {
  id: string;
  metric: IntelMetric;
  confidence: 'LOW' | 'MODERATE' | 'HIGH';
  body: string; // may contain {value} token
}

// --- Content: diagnosis -----------------------------------------------------

export interface DiagnosisContent {
  promptText: string;
  typeDescriptions: Record<RivalType, string>;
  unsureText: string;
  // Tell sheets revealed at debrief (one per type).
  tellSheets: Record<RivalType, string>;
}

// --- Content: rationales ----------------------------------------------------

export interface RationaleSet {
  id: string;
  options: { id: string; label: string }[];
}

// --- Content: epilogue ------------------------------------------------------

export interface EpilogueDecision {
  id: string; // E1..E4
  title: string;
  text: string;
  options: {
    id: string;
    label: string;
    outcomeDelta: number; // adjusts finalOutcome
    terminationLeverage?: boolean; // punishment-scaled bonus applies
  }[];
}

export interface EpiloguePack {
  decisions: EpilogueDecision[];
  // finalOutcome = clamp(base + sum(deltas)); base computed from tracks.
  outcomeFormula: {
    denialWeight: number;
    readinessWeight: number;
    posturebase: number;
    punishmentBattlefieldCap: number; // ≤15% contribution
    terminationPerLevelAbove3: number;
    terminationCap: number;
  };
  settlements: { minOutcome: number; text: string }[];
}

// --- Content: policies (counterfactual profiles) ----------------------------

export interface PolicyProfile {
  id: string;
  name: string;
  description: string;
  // Deterministic decision table over RIVAL_CONTEXT-ish player-facing state.
  probeResponse: {
    // Ordered rules; first match wins. Fallback default at end.
    default: ResponseType;
    rules?: { condition: ConditionExpr; responseType: ResponseType }[];
  };
  // Which signal/track card ids to attempt each turn (in priority order),
  // subject to affordability.
  purchasePlan: {
    // condition-gated buy list; buys attempted top-to-bottom.
    buys: { cardId: string; condition?: ConditionExpr }[];
  };
  typeBelief?: RivalType | 'UNSURE';
}

// --- Content: quiz ----------------------------------------------------------

export interface QuizItem {
  id: string;
  lo: string;
  question: string;
  options: { id: string; label: string; correct: boolean }[];
  explanation: string;
}

// --- Content: scenario ------------------------------------------------------

export interface ScenarioTuning {
  budgetIncome: number;
  pcRegenPerTurn: number;
  pcCap: number;
  decayPerTurn: number;
  concessionSalamiThreshold: number;
  warThresholdConsecutiveTurns: number;
  honoredTestPC: number;
  pivotSubSeeds: number;
  maxPivots: number;
  unsurePenaltyTurnFraction: number; // e.g. 0.6
  trackThreatDeltas: Record<TrackId, number>;
  trackLeadTimeReadinessBonus: number; // turns shaved per readiness level (fractional)
  intelSigmaLevel0: number;
  intelSigmaLevel10: number;
}

export interface ScenarioScoring {
  outcomeBands: { minOutcome: number; label: string; points: number }[];
  weights: {
    outcome: number;
    robustness: number;
    diagnosis: number;
    credibility: number;
    efficiency: number;
  };
}

export interface ScenarioOpening {
  budget: number;
  politicalCapital: number;
  tracks: Record<TrackId, number>;
  priorArmingLevel: number;
  statusQuoIntegrity: number;
}

export interface ScenarioBeat {
  eventId: string;
  minTurn: number;
  maxTurn: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  turnCount: number;
  defaultSeed: number;
  // Optional seed->type pins; else derived from typeFromSeed.
  seedTypePins?: { seed: number; type: RivalType }[];
  opening: ScenarioOpening;
  beats: ScenarioBeat[];
  tuning: ScenarioTuning;
  scoring: ScenarioScoring;
  flavor: string;
}

// --- Assembled, frozen content pack -----------------------------------------

export interface ContentPack {
  scenario: Scenario;
  signals: Card[];
  investments: Card[];
  probes: ProbeCard[];
  rivalTypes: Record<RivalType, RivalTypeDef>;
  rivalRules: RivalRule[];
  events: EventCard[];
  inbox: InboxTemplate[];
  intelTemplates: IntelTemplate[];
  diagnosis: DiagnosisContent;
  rationales: RationaleSet[];
  epilogue: EpiloguePack;
  policies: PolicyProfile[];
  quiz: QuizItem[];
  // Convenience index of all purchasable cards by id.
  cardsById: Record<string, Card>;
}

// --- GameState (§6.4) -------------------------------------------------------

export interface Commitment {
  id: string;
  cardId: string;
  declaredOnTurn: number;
  scopeProbeTags: string[];
  floorResponse: ResponseType;
  backDownPenaltyPC: number;
  upkeepPC: number;
  timesTested: number;
  timesHonored: number;
  status: 'STANDING' | 'HONORED' | 'BROKEN';
}

export interface SignalRecord {
  turn: number;
  cardId: string;
  type: SignalClass;
  cost: { budget: number; politicalCapital: number };
  rationaleId: string;
  offensiveCoded: boolean;
}

export interface ProbeRecord {
  turn: number;
  probeId: string;
  severity: number;
  salamiValue: number;
  responseChosen: string | null;
  responseType: ResponseType;
  statusQuoDelta: number;
}

export interface IntelEstimate {
  turn: number;
  metric: IntelMetric;
  value: number;
  confidence: 'LOW' | 'MODERATE' | 'HIGH';
  sourceFlavorId: string;
}

export interface TypeBeliefRecord {
  turn: number;
  statedType: RivalType | 'UNSURE';
}

export interface PerceptionSnapshot {
  turn: number;
  perceivedCapability: number;
  perceivedResolve: number;
  threatPerception: number;
  warUtility: number;
  internalPressure: number;
}

export interface InboxMessage {
  id: string;
  turn: number;
  voiceId: VoiceId;
  templateId: string;
  subject: string;
  body: string;
  responseOptions?: { id: string; label: string; effects?: EffectSpec[] }[];
  respondedWith?: string;
  read?: boolean;
}

export interface ResolvedEvent {
  turn: number;
  eventId: string;
  effects: EffectSpec[];
  expiresOnTurn?: number;
}

export interface DecisionRecord {
  turn: number;
  kind: 'SIGNAL' | 'INVESTMENT' | 'PROBE_RESPONSE' | 'INBOX' | 'TYPE_BELIEF' | 'EPILOGUE';
  refId: string;
  cost: { budget: number; politicalCapital: number };
  rationaleId?: string;
}

export interface TurnRecord {
  turn: number;
  deltas: {
    budget: number;
    politicalCapital: number;
    statusQuoIntegrity: number;
    tracks: Record<TrackId, number>;
  };
  probeId?: string;
  eventIds: string[];
  endingAfter: null | Ending;
  concessionStreak: number;
}

export interface PendingInvestment {
  trackOrSignalId: string; // cardId
  turnsRemaining: number;
}

export interface ActiveModifier {
  id: string;
  target: string;
  op: 'add' | 'mul' | 'set';
  value: number;
  expiresOnTurn: number;
}

export interface GameState {
  meta: {
    schemaVersion: string;
    scenarioId: string;
    seed: number;
    createdAt: string;
    turnNumber: number;
    epilogueTurn?: number; // E1..E4 => 1..4 when in epilogue
    phase: Phase;
    ending: null | Ending;
    displayName?: string;
    extensions?: Record<string, unknown>;
  };

  rng: {
    streamCursors: Record<RngStream, number>;
    // Per-stream seed overrides used only by the counterfactual sub-seeded
    // pivot runner (§6.12); absent in normal play.
    streamSeeds?: Partial<Record<RngStream, number>>;
  };

  player: {
    budget: number;
    budgetIncome: number;
    politicalCapital: number;
    tracks: Record<TrackId, number>;
    pendingInvestments: PendingInvestment[];
    commitmentRegister: Commitment[];
    backDownCount: number;
    honoredTestCount: number;
    signalHistory: SignalRecord[];
    purchaseCounts: Record<string, number>;
    lastPurchaseTurn: Record<string, number>;
  };

  rival: {
    type: RivalType;
    perceivedCapability: number;
    perceivedResolve: number;
    threatPerception: number;
    internalPressure: number;
    warUtility: number;
    warUtilityStreak: number;
    probeCooldowns: Record<string, number>;
    armingLevel: number;
  };

  world: {
    statusQuoIntegrity: number;
    concessionStreak: number;
    probeLog: ProbeRecord[];
    intel: IntelEstimate[];
    inbox: InboxMessage[];
    eventLog: ResolvedEvent[];
    activeModifiers: ActiveModifier[];
    stagedProbeId: string | null; // probe awaiting response this turn
    biasActive: { metric: IntelMetric; amount: number; expiresOnTurn: number } | null;
    playerDistractionActive: boolean;
  };

  epilogue: null | {
    warOutcomeBase: number;
    decisionsTaken: string[];
    finalOutcome: number;
  };

  analytics: {
    decisions: DecisionRecord[];
    typeBeliefs: TypeBeliefRecord[];
    perceptionHistory: PerceptionSnapshot[];
    turnRecords: TurnRecord[];
    cumulativeSpend: number;
    lockInTurn: number | null; // turn cumulative spend passed 50% of eventual
  };
}

// --- Turn decisions (Annex A.1) ---------------------------------------------

export interface TurnDecisions {
  turn: number;
  probeResponse?: { probeId: string; responseType: ResponseType; rationaleId: string };
  purchases: { cardId: string; rationaleId: string }[];
  inboxResponses?: { messageId: string; optionId: string }[];
  typeBelief?: { statedType: RivalType | 'UNSURE' };
  epilogueChoice?: { decisionId: string; optionId: string };
}
