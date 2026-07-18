# The Red Line — Costly Signals in the Long Pre-War

A serious game on deterrence, credibility, costly signaling, audience costs, and
the security dilemma, built for military professionals and national-security
enthusiasts. Offline, deterministic, browser-based — no backend, no network, no
LLM.

## Stack

React 18 · TypeScript (strict) · Vite · Zustand · Recharts · Ajv 2020 · Vitest.
The `src/engine` core is pure and deterministic (seeded RNG; no `Math.random`,
no `Date`, no I/O).

## Development

```bash
npm ci
npm run dev              # local dev server
npm run lint             # eslint (0 warnings)
npm run typecheck        # tsc --noEmit (app + node projects)
npm run validate-content # Ajv structural + semantic content validation
npm test                 # vitest
npm run build            # tsc -b && vite build
```

## Layout

- `src/engine` — pure game engine: RNG, condition DSL, formulas, resolver, rival
  logic, analytics, counterfactual runner.
- `src/content-loader` — bundled-JSON loader + Ajv validation, producing a
  deep-frozen `ContentPack`.
- `content/` — authored scenarios, baseline content library, and JSON schemas.
- `scripts/validate-content.ts` — Node content validator (CI).
- `tests/` — determinism, purity, content, endings, rival, and counterfactual
  suites.
