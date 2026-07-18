import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../src/ui/format';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/index.css'), 'utf8');

// The IntelReading.confidence union in src/engine/types.ts. Mirrored here so the
// guard fails if a new level is added without a matching CSS rule.
const CONFIDENCE_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;

// Regression guard for the Devin Review finding: the confidence badge builds its
// class as `c-${confidence.toLowerCase()}`, so every confidence level must have
// a matching CSS rule (previously MODERATE -> c-moderate had none).
describe('confidence badge styling', () => {
  it('defines a CSS rule for every intel confidence level', () => {
    for (const c of CONFIDENCE_LEVELS) {
      const cls = `.c-${c.toLowerCase()}`;
      expect(css.includes(cls), `missing CSS rule ${cls}`).toBe(true);
    }
  });
});

describe('glossary explanations', () => {
  it('provides non-empty text for every keyed concept', () => {
    for (const [key, text] of Object.entries(GLOSSARY)) {
      expect(text.length, `empty glossary entry: ${key}`).toBeGreaterThan(20);
    }
  });
});
