import { KEY, isBackspace, isEnter } from '../../engine/input.js';
import type { GameContext, GameInstance, GameModule } from '../../engine/types.js';
import { type Draw, MAX_DEAL, someDeal } from './deck.js';
import { type Stats, renderBoard, renderMenu } from './render.js';
import {
  STOCK_COL,
  WASTE_COL,
  activate,
  drawFromStock,
  dropOn,
  elapsedMs,
  liveRun,
  moveCursor,
  newGame,
  seat,
  seatPile,
  sendHome,
  undoMove,
} from './state.js';

/**
 * One tally per draw mode, because a three card game is a different game and
 * its times have no business being compared with a one card game's.
 */
interface Saved {
  draw: Draw;
  one: Stats;
  three: Stats;
}

const load = (ctx: GameContext): Saved => {
  const saved = ctx.store.read<Partial<Saved>>({});
  const tally = (value: Partial<Stats> | undefined): Stats => ({
    played: value?.played ?? 0,
    won: value?.won ?? 0,
    best: value?.best ?? null,
  });
  return { draw: saved.draw === 3 ? 3 : 1, one: tally(saved.one), three: tally(saved.three) };
};

const start = (ctx: GameContext): GameInstance => {
  const saved = load(ctx);
  let drawMode: Draw = saved.draw;
  let screen: 'menu' | 'board' = 'menu';
  let seed = '';
  let game = newGame(someDeal(), drawMode);
  /** A win is counted once, however many keys are pressed after it. */
  let recorded = false;
  let confirming: { line: string; go: () => void } | null = null;

  const stats = () => (drawMode === 3 ? saved.three : saved.one);

  const save = () => {
    saved.draw = drawMode;
    ctx.store.write(saved satisfies Saved);
  };

  const deal = (number: number) => {
    game = newGame(number, drawMode);
    recorded = false;
    confirming = null;
    screen = 'board';
    stats().played++;
    save();
  };

  const record = () => {
    if (recorded || game.finishedAt === null) return;
    recorded = true;
    const tally = stats();
    const ms = elapsedMs(game);
    tally.won++;
    if (tally.best === null || ms < tally.best) tally.best = ms;
    save();
  };

  /** A run in progress is worth a question rather than one careless keystroke. */
  const guard = (go: () => void) => {
    if (!liveRun(game)) {
      go();
      return;
    }
    confirming = { line: 'Abandon this run?  y or enter goes, n stays', go };
  };

  const onMenuKey = (key: string) => {
    if (key === 'q' || key === KEY.escape) {
      ctx.exit();
      return;
    }
    if (key === KEY.up || key === KEY.down || key === 'k' || key === 'j' || key === 'd' || key === KEY.tab) {
      drawMode = drawMode === 1 ? 3 : 1;
      save();
      return;
    }
    if (isBackspace(key)) {
      seed = seed.slice(0, -1);
      return;
    }
    if (key >= '0' && key <= '9') {
      if (seed.length < String(MAX_DEAL).length) seed += key;
      // A leading zero names no deal, so it is simply never typed.
      if (Number(seed) === 0) seed = '';
      return;
    }
    if (isEnter(key)) {
      const number = Number(seed);
      deal(seed !== '' && number >= 1 && number <= MAX_DEAL ? number : someDeal());
      seed = '';
    }
  };

  const onPlayKey = (key: string) => {
    switch (key) {
      case KEY.up:
      case 'k':
        moveCursor(game, 0, -1);
        return;
      case KEY.down:
      case 'j':
        moveCursor(game, 0, 1);
        return;
      case KEY.left:
      case 'h':
        moveCursor(game, -1, 0);
        return;
      case KEY.right:
      case 'l':
        moveCursor(game, 1, 0);
        return;
      case KEY.space:
        seat(game, 'top', STOCK_COL);
        drawFromStock(game);
        return;
      case '0':
      case 'f':
        seat(game, 'top', WASTE_COL);
        activate(game);
        return;
      case 'a':
        sendHome(game);
        return;
      case 'u':
        undoMove(game);
        return;
      case 'N':
        guard(() => {
          screen = 'menu';
        });
        return;
      case 'r':
        guard(() => deal(game.table.number));
        return;
      case 'q':
      case KEY.escape:
        guard(() => ctx.exit());
        return;
      default:
        if (isEnter(key)) {
          activate(game);
        } else if (key >= '1' && key <= '7') {
          const pile = Number(key) - 1;
          seatPile(game, pile);
          dropOn(game, { kind: 'tableau', pile });
        }
    }
  };

  const onBoardKey = (key: string) => {
    if (confirming) {
      if (isEnter(key) || key === 'y') {
        const { go } = confirming;
        confirming = null;
        go();
      } else if (key === 'n' || key === 'q' || key === KEY.escape) {
        confirming = null;
        game.message = '';
      }
      return;
    }
    if (game.finishedAt !== null) {
      if (key === 'N' || key === 'n') screen = 'menu';
      else if (key === 'r') deal(game.table.number);
      else if (key === 'q' || key === KEY.escape) ctx.exit();
      return;
    }
    onPlayKey(key);
    record();
  };

  return {
    tickMs: 1000,
    render: () =>
      screen === 'menu'
        ? renderMenu(seed, drawMode, stats())
        : renderBoard(game, stats(), confirming?.line ?? null, ctx.columns, ctx.rows),
    onKey: (key) => {
      if (screen === 'menu') onMenuKey(key);
      else onBoardKey(key);
    },
  };
};

export const solitaire: GameModule = {
  id: 'solitaire',
  title: 'Solitaire',
  blurb: 'klondike, one or three card draw, numbered deals',
  start,
};
