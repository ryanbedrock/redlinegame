// ============================================================================
// UI state container. The engine owns all game logic; this store only holds the
// loaded ContentPack, the current GameState, the draft TurnDecisions being
// assembled for the current quarter, and the log of committed decisions (fed to
// the counterfactual report at debrief).
// ============================================================================

import { create } from 'zustand';
import { loadContentPack } from '../content-loader';
import {
  createInitialState,
  resolveEpilogueTurn,
  resolveTurn,
  type ContentPack,
  type GameState,
  type Phase,
  type ResponseType,
  type RivalType,
  type TurnDecisions,
} from '../engine';

// Within a quarter the engine phase stays SITREP; the UI walks the player
// through SITREP → PROBE_RESPONSE → SIGNALS → RESOLUTION locally, then commits.
export type View = Phase;

function emptyDecisions(turn: number): TurnDecisions {
  return { turn, purchases: [] };
}

export interface GameStore {
  content: ContentPack | null;
  state: GameState | null;
  draft: TurnDecisions;
  committed: TurnDecisions[];
  view: View;
  // True once the current quarter has been resolved by the engine, so the
  // resolution screen switches from "resolve" to the outcome summary.
  turnResolved: boolean;

  startGame: (scenarioId: string, seed?: number, displayName?: string) => void;
  setView: (view: View) => void;

  stageProbeResponse: (probeId: string, responseType: ResponseType, rationaleId: string) => void;
  clearProbeResponse: () => void;
  addPurchase: (cardId: string, rationaleId: string) => void;
  removePurchase: (cardId: string) => void;
  stageInboxResponse: (messageId: string, optionId: string) => void;
  setTypeBelief: (statedType: RivalType | 'UNSURE' | null) => void;

  commitTurn: () => void;
  continueAfterResolution: () => void;
  commitEpilogue: (decisionId: string, optionId: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  content: null,
  state: null,
  draft: emptyDecisions(0),
  committed: [],
  view: 'SITREP',
  turnResolved: false,

  startGame: (scenarioId, seed, displayName = 'Principal') => {
    const content = loadContentPack(scenarioId);
    const state = createInitialState(
      content,
      seed ?? content.scenario.defaultSeed,
      new Date().toISOString(),
      displayName,
    );
    set({
      content,
      state,
      draft: emptyDecisions(state.meta.turnNumber),
      committed: [],
      view: 'SITREP',
      turnResolved: false,
    });
  },

  setView: (view) => set({ view }),

  stageProbeResponse: (probeId, responseType, rationaleId) =>
    set((s) => ({ draft: { ...s.draft, probeResponse: { probeId, responseType, rationaleId } } })),

  clearProbeResponse: () =>
    set((s) => {
      const draft = { ...s.draft };
      delete draft.probeResponse;
      return { draft };
    }),

  addPurchase: (cardId, rationaleId) =>
    set((s) => ({
      draft: { ...s.draft, purchases: [...s.draft.purchases, { cardId, rationaleId }] },
    })),

  removePurchase: (cardId) =>
    set((s) => {
      const idx = s.draft.purchases.findIndex((p) => p.cardId === cardId);
      if (idx < 0) return { draft: s.draft };
      const purchases = s.draft.purchases.filter((_, i) => i !== idx);
      return { draft: { ...s.draft, purchases } };
    }),

  stageInboxResponse: (messageId, optionId) =>
    set((s) => {
      const others = (s.draft.inboxResponses ?? []).filter((r) => r.messageId !== messageId);
      return { draft: { ...s.draft, inboxResponses: [...others, { messageId, optionId }] } };
    }),

  setTypeBelief: (statedType) =>
    set((s) => {
      const draft = { ...s.draft };
      if (statedType === null) delete draft.typeBelief;
      else draft.typeBelief = { statedType };
      return { draft };
    }),

  commitTurn: () => {
    const { content, state, draft, committed } = get();
    if (!content || !state) return;
    const decisions: TurnDecisions = { ...draft, turn: state.meta.turnNumber };
    const nextState = resolveTurn(state, decisions, content);
    set({
      state: nextState,
      committed: [...committed, decisions],
      draft: emptyDecisions(nextState.meta.turnNumber),
      // Show the resolution summary; EPILOGUE/DEBRIEF are driven by meta.phase.
      view: 'RESOLUTION',
      turnResolved: true,
    });
  },

  continueAfterResolution: () => set({ view: 'SITREP', turnResolved: false }),

  commitEpilogue: (decisionId, optionId) => {
    const { content, state } = get();
    if (!content || !state) return;
    const nextState = resolveEpilogueTurn(
      state,
      { turn: state.meta.turnNumber, purchases: [], epilogueChoice: { decisionId, optionId } },
      content,
    );
    set({ state: nextState, draft: emptyDecisions(nextState.meta.turnNumber) });
  },

  reset: () =>
    set({
      content: null,
      state: null,
      draft: emptyDecisions(0),
      committed: [],
      view: 'SITREP',
      turnResolved: false,
    }),
}));
