import probeBlockade from '../assets/probe-blockade.webp';
import probeFishing from '../assets/probe-fishing.webp';
import probeIncursion from '../assets/probe-incursion.webp';
import probeSeizure from '../assets/probe-seizure.webp';

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
