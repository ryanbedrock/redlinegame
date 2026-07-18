// Node content validation (npm run validate-content). Reads content from disk,
// validates every scenario pack, and exits non-zero on any failure (AC-3).

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleContentPack, type RawFiles, type SchemaMap } from '../src/content-loader/validate';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const contentDir = join(root, 'content');
const schemasDir = join(contentDir, 'schemas');
const baselineDir = join(contentDir, 'baseline');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadSchemas(): SchemaMap {
  const map: SchemaMap = {};
  for (const file of readdirSync(schemasDir)) {
    if (!file.endsWith('.schema.json')) continue;
    map[file.replace('.schema.json', '')] = readJson(join(schemasDir, file)) as object;
  }
  return map;
}

function sharedFiles(): Omit<RawFiles, 'scenario'> {
  return {
    signals: readJson(join(baselineDir, 'signals.json')),
    investments: readJson(join(baselineDir, 'investments.json')),
    probes: readJson(join(baselineDir, 'probes.json')),
    rivalTypes: readJson(join(baselineDir, 'rival_types.json')),
    rivalRules: readJson(join(baselineDir, 'rival_rules.json')),
    events: readJson(join(baselineDir, 'events.json')),
    inbox: readJson(join(baselineDir, 'inbox.json')),
    intelTemplates: readJson(join(baselineDir, 'intel_templates.json')),
    diagnosis: readJson(join(baselineDir, 'diagnosis.json')),
    rationales: readJson(join(baselineDir, 'rationales.json')),
    epilogue: readJson(join(baselineDir, 'epilogue.json')),
    policies: readJson(join(baselineDir, 'policies.json')),
    quiz: readJson(join(baselineDir, 'quiz.json')),
  };
}

function main(): void {
  const schemas = loadSchemas();
  const shared = sharedFiles();
  const scenarioDirs = ['baseline', 'scenario-2', 'scenario-3'];
  let failed = false;

  for (const dir of scenarioDirs) {
    const scenario = readJson(join(contentDir, dir, 'scenario.json'));
    try {
      const pack = assembleContentPack({ ...shared, scenario }, schemas);
      console.log(
        `OK  ${dir}: ${pack.signals.length} signals, ${pack.investments.length} investments, ` +
          `${pack.probes.length} probes, ${pack.rivalRules.length} rival rules, ${pack.events.length} events`,
      );
    } catch (e) {
      failed = true;
      console.error(`FAIL ${dir}:\n${(e as Error).message}`);
    }
  }

  if (failed) {
    console.error('\nContent validation FAILED.');
    process.exit(1);
  }
  console.log('\nAll content valid.');
}

main();
