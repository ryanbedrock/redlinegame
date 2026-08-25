import probeBlockade from '../assets/probe-blockade.webp';
import probeFishing from '../assets/probe-fishing.webp';
import probeIncursion from '../assets/probe-incursion.webp';
import probeSeizure from '../assets/probe-seizure.webp';
import respBlockadeConcede from '../assets/resp-blockade-concede.webp';
import respBlockadeEnforce from '../assets/resp-blockade-enforce.webp';
import respBlockadeEscalate from '../assets/resp-blockade-escalate.webp';
import respBlockadeMatch from '../assets/resp-blockade-match.webp';
import respBlockadeProtest from '../assets/resp-blockade-protest.webp';
import respFishingConcede from '../assets/resp-fishing-concede.webp';
import respFishingEnforce from '../assets/resp-fishing-enforce.webp';
import respFishingEscalate from '../assets/resp-fishing-escalate.webp';
import respFishingMatch from '../assets/resp-fishing-match.webp';
import respFishingProtest from '../assets/resp-fishing-protest.webp';
import respIncursionConcede from '../assets/resp-incursion-concede.webp';
import respIncursionEnforce from '../assets/resp-incursion-enforce.webp';
import respIncursionEscalate from '../assets/resp-incursion-escalate.webp';
import respIncursionMatch from '../assets/resp-incursion-match.webp';
import respIncursionProtest from '../assets/resp-incursion-protest.webp';
import respSeizureConcede from '../assets/resp-seizure-concede.webp';
import respSeizureEnforce from '../assets/resp-seizure-enforce.webp';
import respSeizureEscalate from '../assets/resp-seizure-escalate.webp';
import respSeizureMatch from '../assets/resp-seizure-match.webp';
import respSeizureProtest from '../assets/resp-seizure-protest.webp';
import type { ResponseType } from '../engine';

type ProbeChart = { src: string; figure: string; alt: string };

// Tactical inset of the theatre chart for each authored provocation. Probes
// without a chart simply render without one.
export const PROBE_CHARTS: Record<string, ProbeChart> = {
  probe_fishing: {
    src: probeFishing,
    figure: 'Fig. 1A',
    alt: 'Chart inset: a swarm of fishing vessels loitering west of the claim line, shadowed by a Dominion coast-guard cutter.',
  },
  probe_incursion: {
    src: probeIncursion,
    figure: 'Fig. 1B',
    alt: 'Chart inset: four Dominion aircraft tracks crossing west over the claim line, with an intercept vector rising from Echo Airfield.',
  },
  probe_blockade: {
    src: probeBlockade,
    figure: 'Fig. 1C',
    alt: 'Chart inset: a declared customs inspection zone astride the sea lane to the Meridian forward islands, with inbound shipping to the west.',
  },
  probe_seizure: {
    src: probeSeizure,
    figure: 'Fig. 1D',
    alt: 'Chart inset: a Dominion landing force on Amber Reef, previously unoccupied, with prefabricated works under construction.',
  },
};

type ResponseChart = { src: string; summary: string; alt: string };

// How the theatre looks if the player answers on a given rung: the same chart
// as the provocation, redrawn with Meridian's own move on it.
export const RESPONSE_CHARTS: Record<string, Partial<Record<ResponseType, ResponseChart>>> = {
  probe_fishing: {
    CONCEDE: {
      src: respFishingConcede,
      summary: 'No action taken. The fleet keeps station and the effective line of control moves west.',
      alt: 'The fishing swarm unopposed, boxed as "no Meridian response", with the effective line of control drawn west of it.',
    },
    PROTEST: {
      src: respFishingProtest,
      summary: 'A formal note crosses the strait. The vessels remain exactly where they were.',
      alt: 'A diplomatic note routed to the Dominion coast while the swarm stays on station.',
    },
    MATCH: {
      src: respFishingMatch,
      summary: 'Your own cutters shadow theirs. Parity maintained, nothing conceded.',
      alt: 'Two Meridian coast-guard cutters alongside the swarm, shadowing the Dominion cutter.',
    },
    ENFORCE: {
      src: respFishingEnforce,
      summary: 'The fleet is escorted out with press embarked, and the footage is released.',
      alt: 'Meridian cutters pushing the swarm east toward the claim line, one with press embarked.',
    },
    ESCALATE: {
      src: respFishingEscalate,
      summary: 'The cutter is interdicted and taken into port; the fleet disperses.',
      alt: 'The Dominion cutter encircled and escorted to Promontory while the fishing swarm scatters east.',
    },
  },
  probe_incursion: {
    CONCEDE: {
      src: respIncursionConcede,
      summary: 'Nothing launches. The tracks run unopposed and your reaction time goes undemonstrated.',
      alt: 'Dominion aircraft tracks crossing west with no intercept launched.',
    },
    PROTEST: {
      src: respIncursionProtest,
      summary: 'The radar picture is declassified and published. The aircraft still flew.',
      alt: 'A declassified radar-scope inset published alongside the unopposed incursion tracks.',
    },
    MATCH: {
      src: respIncursionMatch,
      summary: 'A proportionate intercept meets them for visual identification.',
      alt: 'Two Meridian fighters out of Echo Airfield intercepting the incoming tracks.',
    },
    ENFORCE: {
      src: respIncursionEnforce,
      summary: 'A standing combat air patrol holds the airspace continuously, tanker included.',
      alt: 'A continuous combat air patrol orbit west of the claim line with a tanker track behind it.',
    },
    ESCALATE: {
      src: respIncursionEscalate,
      summary: 'A declared engagement zone, weapons free on repeat incursion, announced publicly.',
      alt: 'A hatched declared engagement zone west of the claim line with patrols and surface-to-air coverage.',
    },
  },
  probe_blockade: {
    CONCEDE: {
      src: respBlockadeConcede,
      summary: 'Shipping routes quietly around the zone. The lane is ceded, at seven days a run.',
      alt: 'Merchant traffic detouring far south of the inspection zone, the original sea lane greyed out.',
    },
    PROTEST: {
      src: respBlockadeProtest,
      summary: 'A joint statement with partner capitals. Traffic is still held at the zone boundary.',
      alt: 'Joint statements radiating to partner capitals while shipping waits west of the zone.',
    },
    MATCH: {
      src: respBlockadeMatch,
      summary: 'An escorted convoy transits the zone on the original lane.',
      alt: 'A Meridian convoy with warship escorts transiting straight through the inspection zone.',
    },
    ENFORCE: {
      src: respBlockadeEnforce,
      summary: 'A task group drives through and the quarantine is not recognised.',
      alt: 'A Meridian task group in wedge formation breaking through the zone, Dominion patrols stood off.',
    },
    ESCALATE: {
      src: respBlockadeEscalate,
      summary: 'A counter-blockade closes the approaches to their own naval bases.',
      alt: 'A Meridian exclusion zone over the Dominion naval approaches, turning their traffic back.',
    },
  },
  probe_seizure: {
    CONCEDE: {
      src: respSeizureConcede,
      summary: 'A note on paper. The garrison consolidates and the effective line bulges west.',
      alt: 'Amber Reef consolidated as a Dominion garrison on routine resupply, the effective line redrawn west.',
    },
    PROTEST: {
      src: respSeizureProtest,
      summary: 'Referred to a tribunal. Construction continues pending a ruling.',
      alt: 'An arbitral case filed while construction on the reef continues under Dominion resupply.',
    },
    MATCH: {
      src: respSeizureMatch,
      summary: 'You land on an adjacent feature. Two garrisons, fifteen miles apart, watching.',
      alt: 'A Meridian detachment landed on Sable Rock south-west of the Dominion-held reef.',
    },
    ENFORCE: {
      src: respSeizureEnforce,
      summary: 'The garrison is blockaded and cut off from resupply.',
      alt: 'A twelve-mile exclusion ring of Meridian warships around the reef with its resupply route cut.',
    },
    ESCALATE: {
      src: respSeizureEscalate,
      summary: 'The feature is retaken by force, with Dominion reinforcements en route.',
      alt: 'A Meridian assault on the reef from three axes, the Dominion supply line cut and reinforcements moving west.',
    },
  },
};
