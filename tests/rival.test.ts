import { describe, expect, it } from 'vitest';
import { typeFromSeed } from '../src/engine/setup';
import { makePolicyDecide, playGame } from '../src/engine/counterfactual';
import { pack, playScripted, rushDenial } from './helpers';

// AC-7: the three hidden rival types are behaviourally distinguishable, and the
// SAME policy can succeed against one type while provoking another.
describe('AC-7 rival distinguishability', () => {
  const content = pack();

  it('seed pins select the intended hidden type', () => {
    expect(typeFromSeed(content, 1)).toBe('OPPORTUNIST');
    expect(typeFromSeed(content, 2)).toBe('PRESSURED_EXPANSIONIST');
    expect(typeFromSeed(content, 3)).toBe('SECURITY_SEEKER');
  });

  it('maximum pressure deters the opportunist but provokes the security-seeker', () => {
    const pressure = content.policies.find((p) => p.id === 'pol_pressure');
    expect(pressure).toBeDefined();
    const decide = makePolicyDecide(pressure!, content);
    const vsOpportunist = playGame(content, 1, decide);
    const vsSecuritySeeker = playGame(content, 3, decide);

    expect(vsSecuritySeeker.finalState.rival.type).toBe('SECURITY_SEEKER');
    expect(vsSecuritySeeker.ending).toBe('WAR');
    // The identical hard-line policy does NOT drive the opportunist to war.
    expect(vsOpportunist.ending).not.toBe('WAR');
  });

  it('reassurance / defensive denial holds the security-seeker but appeasement fails the pressured type', () => {
    const restrained = { probe: 'MATCH' as const, buys: rushDenial };
    const vsSecuritySeeker = playScripted(content, 3, restrained).state;
    expect(vsSecuritySeeker.meta.ending).toBe('DETERRENCE_HOLD');

    const appease = playScripted(content, 2, { probe: 'CONCEDE' }).state;
    expect(appease.meta.ending).toBe('WAR');
  });

  it('does not expose the hidden type to player-facing intel estimates', () => {
    const { state } = playScripted(content, 1, { probe: 'MATCH', maxTurns: 3 });
    const serialized = JSON.stringify(state.world.intel);
    expect(serialized).not.toContain('OPPORTUNIST');
  });
});
