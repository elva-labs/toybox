import { KEY, isBackspace, isEnter } from '../../engine/input.js';
import type { GameContext, GameInstance, GameModule } from '../../engine/types.js';
import {
  type Game,
  clearCell,
  fillNotes,
  hint,
  isSolved,
  moveCursor,
  newGame,
  setDigit,
  undoMove,
} from './state.js';
import {
  DIFFICULTIES,
  renderGame,
  renderGenerating,
  renderMenu,
  renderWon,
} from './render.js';
import type { Difficulty } from './board.js';

type Screen =
  | { name: 'menu'; selected: number }
  | { name: 'generating'; difficulty: Difficulty }
  | { name: 'playing'; game: Game }
  | { name: 'won'; game: Game };

const start = (ctx: GameContext): GameInstance => {
  let screen: Screen = { name: 'menu', selected: 1 };
  let pending: NodeJS.Timeout | null = null;

  const startGame = (difficulty: Difficulty) => {
    screen = { name: 'generating', difficulty };
    // Generation blocks, so let the frame paint first.
    pending = setTimeout(() => {
      pending = null;
      screen = { name: 'playing', game: newGame(difficulty) };
      ctx.render();
    }, 10);
  };

  const onMenuKey = (key: string, state: { selected: number }) => {
    if (key === 'q' || key === KEY.escape) {
      ctx.exit();
      return;
    }
    if (key === KEY.up || key === 'k') state.selected = Math.max(0, state.selected - 1);
    if (key === KEY.down || key === 'j')
      state.selected = Math.min(DIFFICULTIES.length - 1, state.selected + 1);
    if (key >= '1' && key <= '4') {
      state.selected = Number(key) - 1;
      startGame(DIFFICULTIES[state.selected]);
      return;
    }
    if (isEnter(key)) startGame(DIFFICULTIES[state.selected]);
  };

  const onPlayKey = (key: string, game: Game) => {
    game.message = '';

    switch (key) {
      case 'q':
      case KEY.escape:
        ctx.exit();
        return;
      case KEY.up:
      case 'k':
        moveCursor(game, -1, 0);
        break;
      case KEY.down:
      case 'j':
        moveCursor(game, 1, 0);
        break;
      case KEY.left:
      case 'h':
        moveCursor(game, 0, -1);
        break;
      case KEY.right:
      case 'l':
        moveCursor(game, 0, 1);
        break;
      case '0':
      case KEY.space:
        clearCell(game);
        break;
      case 'n':
        game.noteMode = !game.noteMode;
        break;
      case 'a':
        fillNotes(game);
        break;
      case 'u':
        undoMove(game);
        break;
      case 'H':
        hint(game);
        break;
      case 'N':
        screen = { name: 'menu', selected: DIFFICULTIES.indexOf(game.difficulty) };
        return;
      default:
        if (isBackspace(key)) clearCell(game);
        else if (key >= '1' && key <= '9') setDigit(game, Number(key));
    }

    if (isSolved(game)) {
      game.finishedAt = Date.now();
      screen = { name: 'won', game };
    }
  };

  const onWonKey = (key: string, game: Game) => {
    if (key === 'q' || key === KEY.escape) ctx.exit();
    else if (key === 'N' || key === 'n' || isEnter(key))
      screen = { name: 'menu', selected: DIFFICULTIES.indexOf(game.difficulty) };
  };

  return {
    tickMs: 1000,
    render: () => {
      switch (screen.name) {
        case 'menu':
          return renderMenu(screen.selected);
        case 'generating':
          return renderGenerating(screen.difficulty);
        case 'playing':
          return renderGame(screen.game);
        case 'won':
          return renderWon(screen.game);
      }
    },
    onKey: (key) => {
      if (screen.name === 'menu') onMenuKey(key, screen);
      else if (screen.name === 'playing') onPlayKey(key, screen.game);
      else if (screen.name === 'won') onWonKey(key, screen.game);
    },
    dispose: () => {
      if (pending) clearTimeout(pending);
    },
  };
};

export const sudoku: GameModule = {
  id: 'sudoku',
  title: 'Sudoku',
  blurb: 'classic 9x9, four difficulties, pencil marks',
  start,
};
