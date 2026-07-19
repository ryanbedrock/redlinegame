// Assembles the full counterfactual debrief (PRD §6.12/§6.13) for the finished
// campaign: re-runs the pure engine under authored policies, sub-seeded pivots,
// and type-swaps, then derives the score and the per-section audits. Memoized on
// the save so the (deterministic) re-simulation runs once per debrief mount.

import { useMemo } from 'react';
import type { ContentPack, GameState } from '../engine/types';
import type { SaveGame } from '../store/persistence';
import { runCounterfactualReport, type CounterfactualReport } from '../engine/counterfactual';
import {
  computeScore,
  beliefTrajectory,
  salamiAudit,
  signalAudit,
  type ScoreBreakdown,
  type BeliefTrajectory,
  type SalamiStep,
  type SignalAuditRow,
} from '../engine/analytics';

export interface DebriefData {
  report: CounterfactualReport;
  score: ScoreBreakdown;
  belief: BeliefTrajectory;
  salami: SalamiStep[];
  signals: SignalAuditRow[];
}

export function useDebrief(
  state: GameState | null,
  content: ContentPack | null,
  save: SaveGame | null,
): DebriefData | null {
  return useMemo(() => {
    if (!state || !content || !save) return null;
    const report = runCounterfactualReport(content, save.seed, save.decisionLog, state.rival.type);
    const score = computeScore(state, content, report.robustness01);
    return {
      report,
      score,
      belief: beliefTrajectory(state, state.rival.type),
      salami: salamiAudit(state, content),
      signals: signalAudit(state),
    };
    // The report is a pure function of (content, seed, decisionLog); the save id
    // uniquely identifies that tuple for a finished campaign.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, save?.id, save?.decisionLog.length, state?.rival.type]);
}
