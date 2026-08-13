import {
  ALT_SCREEN_OFF,
  ALT_SCREEN_ON,
  CLEAR_LINE,
  HIDE_CURSOR,
  HOME,
  RESET,
  SHOW_CURSOR,
} from './ansi.js';
import { KEY, parseKeys } from './input.js';
import { createLauncher } from './launcher.js';
import { storeFor } from './storage.js';
import type { GameContext, GameInstance, GameModule } from './types.js';

/**
 * Owns the terminal: alternate screen, raw input, the tick timer, and swapping
 * between the launcher and whichever game is running.
 */
export const run = (games: GameModule[]) => {
  if (!process.stdin.isTTY) {
    process.stderr.write('This needs an interactive terminal.\n');
    process.exit(1);
  }

  let current: GameInstance;
  let ticker: NodeJS.Timeout | null = null;

  const draw = () => {
    const body = current
      .render()
      .split('\n')
      .map((line) => line + CLEAR_LINE)
      .join('\n');
    process.stdout.write(`${HOME}${body}\n\x1b[J`);
  };

  const stopTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };

  const startTicker = () => {
    stopTicker();
    if (!current.tickMs) return;
    ticker = setInterval(() => {
      current.onTick?.();
      draw();
    }, current.tickMs);
  };

  const quit = () => {
    stopTicker();
    current?.dispose?.();
    process.stdout.write(`${RESET}${SHOW_CURSOR}${ALT_SCREEN_OFF}`);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.exit(0);
  };

  const swap = (id: string, next: (ctx: GameContext) => GameInstance) => {
    stopTicker();
    current?.dispose?.();
    current = next(contextFor(id));
    startTicker();
    draw();
  };

  const openLauncher = () => swap('launcher', () => createLauncher(games, openGame, quit));

  const openGame = (game: GameModule) => swap(game.id, game.start);

  const contextFor = (id: string): GameContext => ({
    get columns() {
      return process.stdout.columns ?? 80;
    },
    get rows() {
      return process.stdout.rows ?? 24;
    },
    render: draw,
    exit: openLauncher,
    store: storeFor(id),
  });

  process.stdout.write(`${ALT_SCREEN_ON}${HIDE_CURSOR}`);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk: string) => {
    for (const key of parseKeys(chunk)) {
      if (key === KEY.ctrlC) {
        quit();
        return;
      }
      current.onKey(key);
    }
    draw();
  });

  process.stdout.on('resize', draw);
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);

  openLauncher();
};
