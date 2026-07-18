// Routes the active stage to its screen and mounts the persistent HUD during
// play. Menu vs. in-game is decided one level up in App.

import { useGameStore } from '../store/gameStore';
import { Hud } from './Hud';
import { Sitrep } from './Sitrep';
import { ProbeResponse } from './ProbeResponse';
import { SignalsInvestment } from './SignalsInvestment';
import { Inbox } from './Inbox';
import { TypeAssessment } from './TypeAssessment';
import { Resolution } from './Resolution';
import { Epilogue } from './Epilogue';
import { Debrief } from './Debrief';
import { KnowledgeCheck } from './KnowledgeCheck';
import { GuidedTour } from './GuidedTour';

export function GameShell(): JSX.Element {
  const stage = useGameStore((s) => s.stage);

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
      <div className="stage">{screen}</div>
      <GuidedTour />
    </div>
  );
}
