// ============================================================================
// Commitment ledger: reconstructs, for each declared commitment, which probes
// tested it and how each test was honored or broken. Pure derivation from the
// probe log and the commitment register; mirrors the resolver's own rules.
// ============================================================================

import type { Commitment, ContentPack, GameState, ResponseType } from './types';

const RESPONSE_ORDER: ResponseType[] = [
  'CONCEDE',
  'PROTEST',
  'MATCH',
  'ENFORCE',
  'ESCALATE',
];

function meetsFloor(response: ResponseType, floor: ResponseType): boolean {
  return RESPONSE_ORDER.indexOf(response) >= RESPONSE_ORDER.indexOf(floor);
}

export interface CommitmentTest {
  turn: number;
  probeId: string;
  probeTitle: string;
  responseType: ResponseType;
  honored: boolean;
  // Nominal political-capital swing; the resolver scales break penalties by the
  // prevailing audience-cost multiplier, so a break can cost more than this.
  pcDelta: number;
}

export interface CommitmentLedgerEntry {
  commitment: Commitment;
  title: string;
  declaredOnTurn: number;
  floorResponse: ResponseType;
  scopeProbeTags: string[];
  status: Commitment['status'];
  tests: CommitmentTest[];
}

export function commitmentLedger(
  state: GameState,
  content: ContentPack,
): CommitmentLedgerEntry[] {
  const honoredPC = content.scenario.tuning.honoredTestPC;

  return state.player.commitmentRegister.map((c) => {
    const tests: CommitmentTest[] = [];
    for (const p of state.world.probeLog) {
      if (p.turn < c.declaredOnTurn) continue;
      const probe = content.probes.find((x) => x.id === p.probeId);
      if (!probe || !c.scopeProbeTags.some((tag) => probe.tags.includes(tag))) continue;
      const honored = meetsFloor(p.responseType, c.floorResponse);
      tests.push({
        turn: p.turn,
        probeId: p.probeId,
        probeTitle: probe.title,
        responseType: p.responseType,
        honored,
        pcDelta: honored ? honoredPC : -c.backDownPenaltyPC,
      });
      // A broken commitment is never tested again (the resolver skips it).
      if (!honored) break;
    }
    return {
      commitment: c,
      title: content.cardsById[c.cardId]?.title ?? c.cardId,
      declaredOnTurn: c.declaredOnTurn,
      floorResponse: c.floorResponse,
      scopeProbeTags: c.scopeProbeTags,
      status: c.status,
      tests,
    };
  });
}

// One-line plain-language reading of where a commitment stands.
export function commitmentSummary(entry: CommitmentLedgerEntry): string {
  const scope = entry.scopeProbeTags.join(' or ');
  const promise = `You promised at least ${entry.floorResponse} against ${scope} provocations.`;
  const last = entry.tests[entry.tests.length - 1];

  if (entry.status === 'BROKEN' && last) {
    return `${promise} You broke it in Q${last.turn + 1}: ${last.probeTitle} came in and you chose ${last.responseType}, below the floor.`;
  }
  if (entry.status === 'HONORED' && last) {
    const kept = entry.tests.filter((t) => t.honored).length;
    return `${promise} Tested ${kept === 1 ? 'once' : `${kept} times`} and kept — most recently ${last.probeTitle} in Q${last.turn + 1}, answered with ${last.responseType}.`;
  }
  return `${promise} No in-scope provocation has tested it yet, so it costs ${entry.commitment.upkeepPC} PC per quarter to keep standing.`;
}
