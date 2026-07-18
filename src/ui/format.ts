// Small presentation helpers shared across screens.

import type { ProbeCard, TrackId } from '../engine/types';

// Resolve the flavor variant to display for a staged probe. Falls back to the
// probe's base title/text when no variants are authored.
export function probeView(
  probe: ProbeCard,
  variantIndex: number,
): { title: string; text: string } {
  const v = probe.variants?.[variantIndex];
  return v ?? { title: probe.title, text: probe.text };
}

export function signed(n: number, digits = 0): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export const TRACK_LABEL: Record<TrackId, string> = {
  denial: 'Denial',
  punishment: 'Punishment',
  intelligence: 'Intelligence',
  readiness: 'Readiness',
};

export const TRACK_BLURB: Record<TrackId, string> = {
  denial: 'Defensive capacity — makes a fait accompli more likely to fail.',
  punishment: 'Retaliatory reach — raises the cost of aggression (reads offensive).',
  intelligence: 'Collection — tightens your estimates of the Rival.',
  readiness: 'Sustainment — shortens the lead time on everything you build.',
};

export const VOICE_LABEL: Record<string, string> = {
  INTEL_DIRECTOR: 'Director of Intelligence',
  ADVISOR_DEFENSE: 'Defense Advisor',
  ADVISOR_STATE: 'State Advisor',
  CHIEF_OF_STAFF: 'Chief of Staff',
  HEAD_OF_GOVERNMENT: 'Head of Government',
  RIVAL_FOREIGN_MINISTRY: 'Rival Foreign Ministry',
  RIVAL_PUBLIC: 'Rival State Media',
};

// A game turn is a fiscal quarter; render as a 1-based quarter count.
export function quarterLabel(turnNumber: number, turnCount: number): string {
  return `Quarter ${turnNumber + 1} / ${turnCount}`;
}
