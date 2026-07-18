// ============================================================================
// UI state store (Zustand). Wraps the pure engine: holds the live GameState,
// the in-progress "draft" of this quarter's decisions, and the save log. All
// mutation of GameState goes through the engine's resolveTurn/resolveEpilogueTurn
// — the store never edits GameState fields directly. The clock/localStorage live
// here (never in the engine), preserving AC-2 purity.
// ============================================================================

import { create } from 'zustand';
import type {
  ContentPack,
  GameState,
  ResponseType,
  RivalType,
  TurnDecisions,
} from '../engine/types';
import { createInitialState } from '../engine/setup';
import { resolveTurn, resolveEpilogueTurn } from '../engine/resolver';
import { loadContentPack } from '../content-loader';
import {
  SAVE_SCHEMA_VERSION,
  type SaveGame,
  newSaveId,
  writeSave,
  loadSave,
  replay,
} from './persistence';

export type Stage =
  | 'SITREP'
  | 'PROBE'
  | 'SIGNALS'
  | 'INBOX'
  | 'ASSESSMENT'
  | 'RESOLUTION'
  | 'EPILOGUE'
  | 'DEBRIEF';

export interface Draft {
  probeResponse?: { probeId: string; responseType: ResponseType; rationaleId: string };
  purchases: { cardId: string; rationaleId: string }[];
  inboxResponses: { messageId: string; optionId: string }[];
  typeBelief?: RivalType | 'UNSURE';
}

function emptyDraft(): Draft {
  return { purchases: [], inboxResponses: [] };
}

function nowIso(): string {
  return new Date().toISOString();
}

interface GameStore {
  screen: 'MENU' | 'GAME';
  content: ContentPack | null;
  state: GameState | null;
  save: SaveGame | null;
  stage: Stage;
  draft: Draft;
  resolvedTurn: number | null;

  newGame: (scenarioId: string, seed: number, displayName?: string) => void;
  resume: (saveId: string) => void;
  backToMenu: () => void;
  goToStage: (stage: Stage) => void;

  setProbeResponse: (responseType: ResponseType, rationaleId: string) => void;
  togglePurchase: (cardId: string, rationaleId: string) => void;
  setPurchaseRationale: (cardId: string, rationaleId: string) => void;
  setInboxResponse: (messageId: string, optionId: string) => void;
  setTypeBelief: (belief: RivalType | 'UNSURE' | undefined) => void;

  commitTurn: () => void;
  continueAfterResolution: () => void;
  commitEpilogue: (optionId: string) => void;
}

function persist(save: SaveGame, decisionLog: TurnDecisions[]): SaveGame {
  const updated: SaveGame = { ...save, decisionLog, updatedAt: nowIso() };
  writeSave(updated);
  return updated;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'MENU',
  content: null,
  state: null,
  save: null,
  stage: 'SITREP',
  draft: emptyDraft(),
  resolvedTurn: null,

  newGame: (scenarioId, seed, displayName) => {
    const content = loadContentPack(scenarioId);
    const createdAt = nowIso();
    const state = createInitialState(content, seed, createdAt, displayName);
    const save: SaveGame = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      id: newSaveId(scenarioId, seed),
      scenarioId,
      seed,
      displayName,
      createdAt,
      updatedAt: createdAt,
      decisionLog: [],
    };
    writeSave(save);
    set({ screen: 'GAME', content, state, save, stage: 'SITREP', draft: emptyDraft(), resolvedTurn: null });
  },

  resume: (saveId) => {
    const save = loadSave(saveId);
    if (!save) return;
    const content = loadContentPack(save.scenarioId);
    const state = replay(content, save);
    const stage: Stage =
      state.meta.phase === 'EPILOGUE'
        ? 'EPILOGUE'
        : state.meta.phase === 'DEBRIEF'
          ? 'DEBRIEF'
          : 'SITREP';
    set({ screen: 'GAME', content, state, save, stage, draft: emptyDraft(), resolvedTurn: null });
  },

  backToMenu: () => set({ screen: 'MENU' }),

  goToStage: (stage) => set({ stage }),

  setProbeResponse: (responseType, rationaleId) => {
    const { state, draft } = get();
    const probeId = state?.world.stagedProbeId;
    if (!probeId) return;
    set({ draft: { ...draft, probeResponse: { probeId, responseType, rationaleId } } });
  },

  togglePurchase: (cardId, rationaleId) => {
    const { draft } = get();
    const exists = draft.purchases.some((p) => p.cardId === cardId);
    const purchases = exists
      ? draft.purchases.filter((p) => p.cardId !== cardId)
      : [...draft.purchases, { cardId, rationaleId }];
    set({ draft: { ...draft, purchases } });
  },

  setPurchaseRationale: (cardId, rationaleId) => {
    const { draft } = get();
    set({
      draft: {
        ...draft,
        purchases: draft.purchases.map((p) => (p.cardId === cardId ? { ...p, rationaleId } : p)),
      },
    });
  },

  setInboxResponse: (messageId, optionId) => {
    const { draft } = get();
    const others = draft.inboxResponses.filter((r) => r.messageId !== messageId);
    set({ draft: { ...draft, inboxResponses: [...others, { messageId, optionId }] } });
  },

  setTypeBelief: (belief) => {
    const { draft } = get();
    set({ draft: { ...draft, typeBelief: belief } });
  },

  commitTurn: () => {
    const { state, content, draft, save } = get();
    if (!state || !content || !save) return;
    const decision: TurnDecisions = {
      turn: state.meta.turnNumber,
      probeResponse: draft.probeResponse,
      purchases: draft.purchases,
      inboxResponses: draft.inboxResponses.length ? draft.inboxResponses : undefined,
      typeBelief: draft.typeBelief ? { statedType: draft.typeBelief } : undefined,
    };
    const next = resolveTurn(state, decision, content);
    const nextSave = persist(save, [...save.decisionLog, decision]);
    set({ state: next, save: nextSave, stage: 'RESOLUTION', resolvedTurn: state.meta.turnNumber });
  },

  continueAfterResolution: () => {
    const { state } = get();
    if (!state) return;
    if (state.meta.phase === 'EPILOGUE') {
      set({ stage: 'EPILOGUE', draft: emptyDraft() });
    } else if (state.meta.phase === 'DEBRIEF') {
      set({ stage: 'DEBRIEF', draft: emptyDraft() });
    } else {
      set({ stage: 'SITREP', draft: emptyDraft(), resolvedTurn: null });
    }
  },

  commitEpilogue: (optionId) => {
    const { state, content, save } = get();
    if (!state || !content || !save || !state.epilogue) return;
    const eTurn = state.meta.epilogueTurn ?? 1;
    const decision = content.epilogue.decisions[eTurn - 1];
    if (!decision) return;
    const td: TurnDecisions = {
      turn: state.meta.turnNumber,
      purchases: [],
      epilogueChoice: { decisionId: decision.id, optionId },
    };
    const next = resolveEpilogueTurn(state, td, content);
    const nextSave = persist(save, [...save.decisionLog, td]);
    const stage: Stage = next.meta.phase === 'DEBRIEF' ? 'DEBRIEF' : 'EPILOGUE';
    set({ state: next, save: nextSave, stage });
  },
}));
