// ============================================================================
// Commitment ledger: for each declared commitment, which probes tested it and
// how each test was honored or broken. Reads the tests the resolver recorded,
// so the political-capital swing is the one actually applied.
// ============================================================================

import type { Commitment, ContentPack, GameState, ResponseType } from './types';

export interface CommitmentTest {
  turn: number;
  probeId: string;
  probeTitle: string;
  responseType: ResponseType;
  honored: boolean;
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
  return state.player.commitmentRegister.map((c) => {
    const tests: CommitmentTest[] = state.analytics.commitmentTests
      .filter((t) => t.commitmentId === c.id)
      .map((t) => ({
        turn: t.turn,
        probeId: t.probeId,
        probeTitle: content.probes.find((p) => p.id === t.probeId)?.title ?? t.probeId,
        responseType: t.responseType,
        honored: t.honored,
        pcDelta: t.pcDelta,
      }));
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
