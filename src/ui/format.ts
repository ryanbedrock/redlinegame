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

// Short, game-context explanations surfaced through InfoTip / Tooltip. Keyed so
// screens and the guided tour can reuse the same wording.
export const GLOSSARY = {
  budget:
    'Your fiscal resources this quarter. Spent on signals and on investments (denial, punishment, intelligence, readiness). Unspent budget carries over.',
  politicalCapital:
    'The domestic/executive capital you spend on costly moves — tied-hands commitments, forceful probe responses, and some investments. Runs out if overspent.',
  statusQuo:
    'Effective control of your claimed maritime space — territorial sea, contiguous zone, and EEZ. Starts at 100 (claims intact). Conceding probes erodes it; reaching 0 is capitulation (a loss).',
  denial:
    'Defensive capacity. Higher denial makes a Rival fait accompli (a quick seizure) more likely to fail — deterrence by denial.',
  punishment:
    'Retaliatory reach. Raises the cost the Rival expects to pay for aggression — deterrence by punishment. Reads as offensive and can spook a fearful Rival.',
  intelligence:
    'Collection. Higher intelligence permanently narrows the error bars on your estimates of the Rival, so your reads are more trustworthy.',
  readiness:
    'Sustainment and lift. Shortens the lead time on everything else you build, so investments complete sooner.',
  intelEstimates:
    'Your intelligence product: noisy reads of hidden facts (the Rival\u2019s view of your resolve/capability, its intent, and its arming). Confidence — LOW/MODERATE/HIGH — reflects your collection posture, not certainty.',
  probe:
    'A provocation the Rival stages this quarter. How you respond signals your resolve. There are four archetypes (grey-zone maritime presence, air incursion, sea-lane cordon, feature seizure), each with several variants.',
  signalClass:
    'Signals differ in credibility. Cheap talk is nearly free and rarely believed; sunk-cost burns resources visibly; tied-hands imposes a domestic penalty for backing down (which is what makes it credible); reassurance calms a fearful Rival at some cost to how resolved you look.',
  investment:
    'A purchase that completes after a lead time (shown in quarters), then permanently raises a track. Readiness shortens these lead times.',
  responseLadder:
    'Your options run from Concede (yield) through Protest, Match, and Enforce up to Escalate. Higher rungs signal more resolve but cost more and carry more escalation risk.',
  assessment:
    'Where you log your read of the Rival\u2019s hidden type (Opportunist, Pressured Expansionist, or Security Seeker). Your calibration over time is scored at the debrief.',
  concessionStreak:
    'Consecutive quarters you\u2019ve conceded. A streak invites salami-slicing: the Rival escalates the tempo and severity of its probes because backing down has taught it you will fold.',
} as const;

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
