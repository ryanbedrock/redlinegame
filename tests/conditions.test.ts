import { describe, expect, it } from 'vitest';
import { evalBool, evalExpr, validateCondition } from '../src/engine/conditions';
import type { ConditionExpr } from '../src/engine/types';

describe('condition DSL', () => {
  const vars = {
    turn: 5,
    perceivedResolve: 0.3,
    concessionStreak: 2,
    'tracks.denial': 4,
  };

  it('evaluates comparisons and boolean composition', () => {
    const expr: ConditionExpr = {
      all: [{ lt: [{ var: 'perceivedResolve' }, 0.34] }, { lt: [{ var: 'tracks.denial' }, 5] }],
    };
    expect(evalBool(expr, vars)).toBe(true);
  });

  it('evaluates arithmetic reducers', () => {
    expect(evalExpr({ add: [{ var: 'turn' }, 3] }, vars)).toBe(8);
    expect(evalExpr({ mul: [{ var: 'concessionStreak' }, 4] }, vars)).toBe(8);
  });

  it('accepts the literal true condition', () => {
    expect(evalBool(true, vars)).toBe(true);
  });

  it('rejects unknown operators (no eval / no arbitrary code)', () => {
    expect(() => validateCondition({ exec: ['rm', '-rf'] }, 'test', 'RIVAL_CONTEXT')).toThrow();
  });

  it('forbids hidden rival variables in the player context', () => {
    // warUtility / threatPerception are hidden ledgers — usable by rival rules
    // but must never leak into player-facing (policy) conditions.
    expect(() => validateCondition({ gt: [{ var: 'warUtility' }, 0.5] }, 'p', 'RIVAL_CONTEXT')).not.toThrow();
    expect(() => validateCondition({ gt: [{ var: 'warUtility' }, 0.5] }, 'p', 'PLAYER_CONTEXT')).toThrow();
    expect(() => validateCondition({ gt: [{ var: 'threatPerception' }, 0.5] }, 'p', 'PLAYER_CONTEXT')).toThrow();
  });
});
