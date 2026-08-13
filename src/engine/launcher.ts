import { BOLD, DIM, INVERSE, MAGENTA, paint } from './ansi.js';
import { KEY, isEnter } from './input.js';
import type { GameInstance, GameModule } from './types.js';

export const createLauncher = (
  games: GameModule[],
  onSelect: (game: GameModule) => void,
  onQuit: () => void,
): GameInstance => {
  let selected = 0;

  const render = () => {
    const lines = ['', `  ${paint('ARCADE', BOLD, MAGENTA)}`, '', `  ${paint('pick a game', DIM)}`, ''];

    games.forEach((game, i) => {
      const chosen = i === selected;
      const label = `${i + 1}  ${game.title}`;
      lines.push(`    ${chosen ? paint(` ${label} `, INVERSE) : `  ${label}`}`);
      lines.push(`       ${paint(game.blurb, DIM)}`);
      lines.push('');
    });

    lines.push(`  ${paint('up/down to choose, enter to play, q to quit', DIM)}`, '');
    return lines.join('\n');
  };

  const onKey = (key: string) => {
    if (key === 'q') onQuit();
    else if (key === KEY.up || key === 'k') selected = Math.max(0, selected - 1);
    else if (key === KEY.down || key === 'j') selected = Math.min(games.length - 1, selected + 1);
    else if (key >= '1' && key <= String(Math.min(9, games.length))) {
      selected = Number(key) - 1;
      onSelect(games[selected]);
    } else if (isEnter(key)) onSelect(games[selected]);
  };

  return { render, onKey };
};
