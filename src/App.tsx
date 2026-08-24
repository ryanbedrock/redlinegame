import { Debrief } from './components/Debrief';
import { Epilogue } from './components/Epilogue';
import { ProbeResponse } from './components/ProbeResponse';
import { Resolution } from './components/Resolution';
import { ScenarioSelect } from './components/ScenarioSelect';
import { SignalsInvestments } from './components/SignalsInvestments';
import { Sitrep } from './components/Sitrep';
import { useGameStore } from './store/gameStore';

// Routes the active game to the phase screen. The engine owns meta.phase for
// the terminal phases; within a quarter the store's `view` walks the player
// through sitrep → probe → signals → resolution.
export function App(): JSX.Element {
  const content = useGameStore((s) => s.content);
  const state = useGameStore((s) => s.state);
  const view = useGameStore((s) => s.view);
  const turnResolved = useGameStore((s) => s.turnResolved);

  if (!content || !state) return <ScenarioSelect />;

  // The resolution summary of the final quarter is shown before handing off to
  // the epilogue or debrief.
  if (view === 'RESOLUTION' && turnResolved) return <Resolution state={state} content={content} />;

  if (state.meta.phase === 'EPILOGUE') return <Epilogue state={state} content={content} />;
  if (state.meta.phase === 'DEBRIEF') return <Debrief state={state} content={content} />;

  switch (view) {
    case 'PROBE_RESPONSE':
      return <ProbeResponse state={state} content={content} />;
    case 'SIGNALS':
      return <SignalsInvestments state={state} content={content} />;
    case 'RESOLUTION':
      return <Resolution state={state} content={content} />;
    default:
      return <Sitrep state={state} content={content} />;
  }
}
