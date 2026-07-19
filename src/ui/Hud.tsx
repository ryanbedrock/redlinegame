// Persistent command-bar: resources, force posture, and quarter clock. Shows
// only player-visible state — never the hidden Rival ledgers or type.

import { useGameStore } from '../store/gameStore';
import { TRACK_IDS } from '../engine/types';
import { TRACK_LABEL, GLOSSARY, quarterLabel } from './format';
import { InfoTip, Tooltip } from './InfoTip';

const TRACK_GLOSSARY = {
  denial: GLOSSARY.denial,
  punishment: GLOSSARY.punishment,
  intelligence: GLOSSARY.intelligence,
  readiness: GLOSSARY.readiness,
} as const;

export function Hud(): JSX.Element | null {
  const state = useGameStore((s) => s.state);
  const content = useGameStore((s) => s.content);
  const stage = useGameStore((s) => s.stage);
  const goToStage = useGameStore((s) => s.goToStage);
  const backToMenu = useGameStore((s) => s.backToMenu);
  const seenMessageIds = useGameStore((s) => s.seenMessageIds);
  const startTour = useGameStore((s) => s.startTour);

  if (!state || !content) return null;

  const seen = new Set(seenMessageIds);
  const unread = state.world.inbox.filter((m) => !m.respondedWith && !seen.has(m.id)).length;
  const planning = stage === 'SITREP' || stage === 'PROBE' || stage === 'SIGNALS' || stage === 'INBOX' || stage === 'ASSESSMENT';
  const sq = state.world.statusQuoIntegrity;
  const sqTone = sq <= 25 ? 'danger' : sq <= 50 ? 'warn' : 'good';

  return (
    <header className="hud">
      <div className="hud-left">
        <div className="hud-title">
          <span className="brand">THE RED LINE</span>
          <span className="scenario">{content.scenario.name}</span>
        </div>
        <div className="hud-clock" data-tour="clock">
          {quarterLabel(state.meta.turnNumber, content.scenario.turnCount)}
        </div>
      </div>

      <div className="hud-resources" data-tour="resources">
        <div className="res">
          <span className="res-label">
            Budget
            <InfoTip term="Budget" label={GLOSSARY.budget} side="bottom" />
          </span>
          <span className="res-val">{Math.round(state.player.budget)}</span>
        </div>
        <div className="res">
          <span className="res-label">
            Political Capital
            <InfoTip term="Political Capital" label={GLOSSARY.politicalCapital} side="bottom" />
          </span>
          <span className="res-val">{Math.round(state.player.politicalCapital)}</span>
        </div>
        <div className="res" data-tour="statusquo">
          <span className="res-label">
            Status Quo
            <InfoTip term="Status Quo" label={GLOSSARY.statusQuo} side="bottom" />
          </span>
          <span className={`res-val sq-${sqTone}`}>{Math.round(sq)}</span>
        </div>
      </div>

      <div className="hud-tracks" data-tour="tracks">
        {TRACK_IDS.map((t) => (
          <Tooltip key={t} label={TRACK_GLOSSARY[t]} side="bottom" className="track-chip" focusableTrigger>
            <span className="track-name">{TRACK_LABEL[t]}</span>
            <span className="track-level">{state.player.tracks[t]}</span>
          </Tooltip>
        ))}
      </div>

      {planning && (
        <nav className="hud-nav" aria-label="Command actions">
          <Tooltip label="Correspondence from your cabinet and the Rival. Some messages carry response options with real effects (like tasking intelligence collection); most are context." side="bottom">
            <button
              type="button"
              data-tour="nav-inbox"
              className={stage === 'INBOX' ? 'active' : ''}
              onClick={() => goToStage('INBOX')}
            >
              Inbox{unread > 0 && <span className="badge">{unread}</span>}
            </button>
          </Tooltip>
          <Tooltip label={GLOSSARY.assessment} side="bottom">
            <button
              type="button"
              data-tour="nav-assessment"
              className={stage === 'ASSESSMENT' ? 'active' : ''}
              onClick={() => goToStage('ASSESSMENT')}
            >
              Assessment
            </button>
          </Tooltip>
          <Tooltip label="Replay the guided walkthrough of this screen." side="bottom">
            <button type="button" className="ghost" aria-label="Guided tour" onClick={startTour}>
              ?
            </button>
          </Tooltip>
          <Tooltip label="Return to the main menu. Your campaign is saved automatically." side="bottom">
            <button type="button" className="ghost" onClick={backToMenu}>
              Menu
            </button>
          </Tooltip>
        </nav>
      )}
    </header>
  );
}
