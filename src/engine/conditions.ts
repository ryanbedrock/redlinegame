// ============================================================================
// Condition DSL evaluator (PRD §6.6, Annex A.2).
//
// JSON expression trees with a whitelisted operator set and two evaluation
// contexts, each with its own variable whitelist. No eval, no string
// interpolation, no user functions. An unknown op or variable — or a
// hidden-ledger variable used in PLAYER_CONTEXT — is a content-load failure
// (AC-3, and the AC-10 principle applied to content).
//
// Pure module (AC-2): no I/O, no clock, no randomness.
// ============================================================================

import type { ConditionExpr, EvalContextName } from './types';

export type DslValue = number | string | boolean;

// Variable whitelists per context (Annex A.2).
export const RIVAL_VARS = new Set<string>([
  'turn',
  'turnCount',
  'statusQuoIntegrity',
  'perceivedResolve',
  'perceivedCapability',
  'threatPerception',
  'internalPressure',
  'warUtility',
  'armingLevel',
  'concessionStreak',
  'backDownCount',
  'effectiveBackDowns',
  'honoredTestCount',
  'playerDistractionActive',
  'tracks.denial',
  'tracks.punishment',
  'tracks.intelligence',
  'tracks.readiness',
  'politicalCapital',
  'budget',
]);

export const PLAYER_VARS = new Set<string>([
  'turn',
  'turnCount',
  'statusQuoIntegrity',
  'politicalCapital',
  'budget',
  'backDownCount',
  'honoredTestCount',
  'concessionStreak',
  'statedTypeBelief',
  'playerDistractionActive',
  'tracks.denial',
  'tracks.punishment',
  'tracks.intelligence',
  'tracks.readiness',
]);

export type VarBag = Record<string, DslValue>;

function isLeafObject(e: ConditionExpr): e is { var: string } {
  return typeof e === 'object' && e !== null && 'var' in e;
}

function asNumber(v: DslValue): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`DSL: cannot coerce "${v}" to number`);
  return n;
}

// Evaluate an expression node to a DslValue against a flat variable bag.
export function evalExpr(expr: ConditionExpr, vars: VarBag): DslValue {
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') {
    return expr;
  }
  if (isLeafObject(expr)) {
    const v = vars[expr.var];
    if (v === undefined) throw new Error(`DSL: unknown variable "${expr.var}"`);
    return v;
  }
  const o = expr as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 1) throw new Error(`DSL: node must have exactly one op, got [${keys.join(',')}]`);
  const op = keys[0];
  const arg = o[op];

  switch (op) {
    case 'all':
      return (arg as ConditionExpr[]).every((a) => evalBool(a, vars));
    case 'any':
      return (arg as ConditionExpr[]).some((a) => evalBool(a, vars));
    case 'not':
      return !evalBool(arg as ConditionExpr, vars);
    case 'eq': {
      const [a, b] = arg as [ConditionExpr, ConditionExpr];
      return evalExpr(a, vars) === evalExpr(b, vars);
    }
    case 'neq': {
      const [a, b] = arg as [ConditionExpr, ConditionExpr];
      return evalExpr(a, vars) !== evalExpr(b, vars);
    }
    case 'gt': {
      const [a, b] = arg as [ConditionExpr, ConditionExpr];
      return asNumber(evalExpr(a, vars)) > asNumber(evalExpr(b, vars));
    }
    case 'gte': {
      const [a, b] = arg as [ConditionExpr, ConditionExpr];
      return asNumber(evalExpr(a, vars)) >= asNumber(evalExpr(b, vars));
    }
    case 'lt': {
      const [a, b] = arg as [ConditionExpr, ConditionExpr];
      return asNumber(evalExpr(a, vars)) < asNumber(evalExpr(b, vars));
    }
    case 'lte': {
      const [a, b] = arg as [ConditionExpr, ConditionExpr];
      return asNumber(evalExpr(a, vars)) <= asNumber(evalExpr(b, vars));
    }
    case 'between': {
      const [x, lo, hi] = arg as [ConditionExpr, ConditionExpr, ConditionExpr];
      const xv = asNumber(evalExpr(x, vars));
      return xv >= asNumber(evalExpr(lo, vars)) && xv <= asNumber(evalExpr(hi, vars));
    }
    case 'in': {
      const [x, list] = arg as [ConditionExpr, (string | number)[]];
      return list.includes(evalExpr(x, vars) as string | number);
    }
    case 'add':
      return (arg as ConditionExpr[]).reduce<number>((s, a) => s + asNumber(evalExpr(a, vars)), 0);
    case 'sub': {
      const [a, b] = arg as [ConditionExpr, ConditionExpr];
      return asNumber(evalExpr(a, vars)) - asNumber(evalExpr(b, vars));
    }
    case 'mul':
      return (arg as ConditionExpr[]).reduce<number>((s, a) => s * asNumber(evalExpr(a, vars)), 1);
    case 'min':
      return Math.min(...(arg as ConditionExpr[]).map((a) => asNumber(evalExpr(a, vars))));
    case 'max':
      return Math.max(...(arg as ConditionExpr[]).map((a) => asNumber(evalExpr(a, vars))));
    default:
      throw new Error(`DSL: unknown operator "${op}"`);
  }
}

export function evalBool(expr: ConditionExpr, vars: VarBag): boolean {
  const v = evalExpr(expr, vars);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return v !== '' && v !== 'false';
}

// ---------------------------------------------------------------------------
// Validation (content load): whitelist ops + variables per context.
// ---------------------------------------------------------------------------

const BOOL_OPS = new Set(['all', 'any', 'not']);
const CMP_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in']);
const ARITH_OPS = new Set(['add', 'sub', 'mul', 'min', 'max']);

export function validateCondition(
  expr: unknown,
  where: string,
  context: EvalContextName,
): void {
  const allowed = context === 'RIVAL_CONTEXT' ? RIVAL_VARS : PLAYER_VARS;
  walk(expr as ConditionExpr, where, allowed);
}

function walk(expr: ConditionExpr, where: string, allowed: Set<string>): void {
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') {
    return;
  }
  if (expr === null || typeof expr !== 'object') {
    throw new Error(`${where}: invalid condition node`);
  }
  if ('var' in expr) {
    const name = (expr as { var: string }).var;
    if (!allowed.has(name)) {
      throw new Error(`${where}: variable "${name}" is not permitted in this context`);
    }
    return;
  }
  const keys = Object.keys(expr);
  if (keys.length !== 1) {
    throw new Error(`${where}: node must have exactly one operator`);
  }
  const op = keys[0];
  if (!BOOL_OPS.has(op) && !CMP_OPS.has(op) && !ARITH_OPS.has(op)) {
    throw new Error(`${where}: unknown operator "${op}"`);
  }
  const arg = (expr as Record<string, unknown>)[op];
  if (op === 'not') {
    walk(arg as ConditionExpr, where, allowed);
    return;
  }
  if (op === 'in') {
    const [x] = arg as [ConditionExpr, unknown];
    walk(x, where, allowed);
    return;
  }
  if (Array.isArray(arg)) {
    for (const a of arg) walk(a as ConditionExpr, where, allowed);
    return;
  }
  throw new Error(`${where}: operator "${op}" expects an array of operands`);
}
