// ============================================================================
// Browser content loader. Imports authored JSON (bundled by Vite — no runtime
// network) and the JSON schemas, then assembles + validates + freezes a
// ContentPack. All scenarios share the baseline content library and differ only
// in scenario.json (opening state + tuning + seed + beats).
// ============================================================================

import type { ContentPack } from '../engine/types';
import { assembleContentPack, type RawFiles, type SchemaMap } from './validate';

import signals from '../../content/baseline/signals.json';
import investments from '../../content/baseline/investments.json';
import probes from '../../content/baseline/probes.json';
import rivalTypes from '../../content/baseline/rival_types.json';
import rivalRules from '../../content/baseline/rival_rules.json';
import events from '../../content/baseline/events.json';
import inbox from '../../content/baseline/inbox.json';
import intelTemplates from '../../content/baseline/intel_templates.json';
import diagnosis from '../../content/baseline/diagnosis.json';
import rationales from '../../content/baseline/rationales.json';
import epilogue from '../../content/baseline/epilogue.json';
import policies from '../../content/baseline/policies.json';
import quiz from '../../content/baseline/quiz.json';

import scenarioBaseline from '../../content/baseline/scenario.json';
import scenario2 from '../../content/scenario-2/scenario.json';
import scenario3 from '../../content/scenario-3/scenario.json';

import schemaScenario from '../../content/schemas/scenario.schema.json';
import schemaCards from '../../content/schemas/cards.schema.json';
import schemaProbes from '../../content/schemas/probes.schema.json';
import schemaRivalTypes from '../../content/schemas/rival_types.schema.json';
import schemaRivalRules from '../../content/schemas/rival_rules.schema.json';
import schemaEvents from '../../content/schemas/events.schema.json';
import schemaInbox from '../../content/schemas/inbox.schema.json';
import schemaIntelTemplates from '../../content/schemas/intel_templates.schema.json';
import schemaDiagnosis from '../../content/schemas/diagnosis.schema.json';
import schemaRationales from '../../content/schemas/rationales.schema.json';
import schemaEpilogue from '../../content/schemas/epilogue.schema.json';
import schemaPolicies from '../../content/schemas/policies.schema.json';
import schemaQuiz from '../../content/schemas/quiz.schema.json';

export const SCHEMAS: SchemaMap = {
  scenario: schemaScenario,
  cards: schemaCards,
  probes: schemaProbes,
  rival_types: schemaRivalTypes,
  rival_rules: schemaRivalRules,
  events: schemaEvents,
  inbox: schemaInbox,
  intel_templates: schemaIntelTemplates,
  diagnosis: schemaDiagnosis,
  rationales: schemaRationales,
  epilogue: schemaEpilogue,
  policies: schemaPolicies,
  quiz: schemaQuiz,
};

const SHARED = {
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
};

const SCENARIO_FILES: Record<string, unknown> = {
  'scenario-1': scenarioBaseline,
  'scenario-2': scenario2,
  'scenario-3': scenario3,
};

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
}

export function listScenarios(): ScenarioSummary[] {
  return Object.values(SCENARIO_FILES).map((s) => {
    const sc = s as { id: string; name: string; description: string };
    return { id: sc.id, name: sc.name, description: sc.description };
  });
}

const cache = new Map<string, ContentPack>();

export function loadContentPack(scenarioId: string): ContentPack {
  const cached = cache.get(scenarioId);
  if (cached) return cached;
  const scenario = SCENARIO_FILES[scenarioId];
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  const raw: RawFiles = { ...SHARED, scenario };
  const pack = assembleContentPack(raw, SCHEMAS);
  cache.set(scenarioId, pack);
  return pack;
}

export { assembleContentPack } from './validate';
export type { RawFiles, SchemaMap } from './validate';
