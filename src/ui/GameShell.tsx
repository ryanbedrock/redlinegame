// Routes the active stage to its screen and mounts the persistent HUD during
// play. Menu vs. in-game is decided one level up in App.

import { Suspense, lazy, useEffect, useRef } from 'react';
import { useGameStore, type Stage } from '../store/gameStore';
import { Hud } from './Hud';
import { Sitrep } from './Sitrep';
import { ProbeResponse } from './ProbeResponse';
import { SignalsInvestment } from './SignalsInvestment';
import { Inbox } from './Inbox';
import { TypeAssessment } from './TypeAssessment';
import { Resolution } from './Resolution';
import { Epilogue } from './Epilogue';
import { KnowledgeCheck } from './KnowledgeCheck';
import { GuidedTour } from './GuidedTour';

// The debrief is the sole Recharts consumer and pulls in the counterfactual
// re-simulation; it is only reached at end-of-campaign, so we code-split it out
// of the main bundle (§2.6) and show a fallback while its chunk loads (§2.1).
const Debrief = lazy(() => import('./Debrief').then((m) => ({ default: m.Debrief })));

const STAGE_LABEL: Record<Stage, string> = {
  SITREP: 'Situation Report',
  PROBE: 'Probe Response',
  SIGNALS: 'Signals & Investment',
  INBOX: 'Inbox',
  ASSESSMENT: 'Rival Assessment',
  RESOLUTION: 'Resolution',
  EPILOGUE: 'War Epilogue',
  DEBRIEF: 'After-Action Debrief',
  KNOWLEDGE: 'Knowledge Check',
};

export function GameShell(): JSX.Element {
  const stage = useGameStore((s) => s.stage);
  const saveError = useGameStore((s) => s.saveError);
  const dismissSaveError = useGameStore((s) => s.dismissSaveError);
  const stageRef = useRef<HTMLDivElement>(null);

  // On each stage change the whole screen is swapped; move focus to the new
  // container so keyboard focus never strands on an unmounted button (WCAG
  // 2.4.3). The stage name is also mirrored into a live region below (4.1.3).
  // While the guided tour owns focus (it opens over SITREP on a new game), let
  // the tour keep it — read tourOpen imperatively rather than as a dependency so
  // closing the tour doesn't re-run this and steal the focus the tour restores
  // to the button that opened it (e.g. the HUD "?" on a mid-game replay).
  useEffect(() => {
    if (useGameStore.getState().tourOpen) return;
    stageRef.current?.focus();
  }, [stage]);

  const screen = (() => {
    switch (stage) {
      case 'SITREP':
        return <Sitrep />;
      case 'PROBE':
        return <ProbeResponse />;
      case 'SIGNALS':
        return <SignalsInvestment />;
      case 'INBOX':
        return <Inbox />;
      case 'ASSESSMENT':
        return <TypeAssessment />;
      case 'RESOLUTION':
        return <Resolution />;
      case 'EPILOGUE':
        return <Epilogue />;
      case 'DEBRIEF':
        return <Debrief />;
      case 'KNOWLEDGE':
        return <KnowledgeCheck />;
      default:
        return <Sitrep />;
    }
  })();

  const showHud = stage !== 'DEBRIEF' && stage !== 'KNOWLEDGE';

  return (
    <div className="game-shell">
      {showHud && <Hud />}
      {saveError && (
        <div className="alert danger save-error" role="alert">
          <span>
            Couldn&rsquo;t save this campaign — your browser storage is full or unavailable
            (e.g. private mode). Play continues, but progress won&rsquo;t persist if you leave.
          </span>
          <button type="button" className="ghost" onClick={dismissSaveError}>
            Dismiss
          </button>
        </div>
      )}
      <div className="stage" ref={stageRef} tabIndex={-1}>
        <Suspense fallback={<p className="muted">Preparing after-action debrief…</p>}>
          {screen}
        </Suspense>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {STAGE_LABEL[stage]}
      </p>
      <GuidedTour />
    </div>
  );
}
