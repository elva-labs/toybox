import { KEY, isBackspace, isEnter } from '../../engine/input.js';
import type { GameContext, GameInstance, GameModule } from '../../engine/types.js';
import { type Game, deleteLetter, newGame, submitGuess, typeLetter } from './state.js';
import { renderGame } from './render.js';

const start = (ctx: GameContext): GameInstance => {
  let game: Game = newGame();

  const onPlayKey = (key: string) => {
    if (isBackspace(key)) {
      deleteLetter(game);
      return;
    }
    if (isEnter(key)) {
      submitGuess(game);
      return;
    }
    if (/^[a-zA-Z]$/.test(key)) typeLetter(game, key.toLowerCase());
  };

  const onOverKey = (key: string) => {
    if (key === 'n' || key === 'N' || isEnter(key)) game = newGame();
  };

  return {
    render: () => renderGame(game),
    onKey: (key) => {
      // No 'q' shortcut here, unlike the other games. It has to stay typable.
      if (key === KEY.escape) {
        ctx.exit();
        return;
      }
      if (game.status === 'playing') onPlayKey(key);
      else onOverKey(key);
    },
  };
};

export const wordle: GameModule = {
  id: 'wordle',
  title: 'Wordle',
  blurb: 'six guesses, five letters',
  start,
};
