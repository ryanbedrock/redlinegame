import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { GameShell } from './ui/GameShell';

export function App(): JSX.Element {
  const screen = useGameStore((s) => s.screen);
  return screen === 'GAME' ? <GameShell /> : <MainMenu />;
}
