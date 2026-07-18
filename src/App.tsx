import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { GameShell } from './ui/GameShell';
import { Tutorial } from './ui/Tutorial';
import { About } from './ui/About';

export function App(): JSX.Element {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'GAME':
      return <GameShell />;
    case 'TUTORIAL':
      return <Tutorial />;
    case 'ABOUT':
      return <About />;
    default:
      return <MainMenu />;
  }
}
