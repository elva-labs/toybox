import type { GameStore } from './storage.js';

/** What the runtime hands a game when it starts. */
export interface GameContext {
  /** Live terminal size. */
  readonly columns: number;
  readonly rows: number;
  /** Repaint now. Keys and ticks repaint on their own; use this after async work. */
  render(): void;
  /** Leave the game and return to the launcher. */
  exit(): void;
  /**
   * Anything worth keeping between sessions: high scores, best times, streaks.
   * Scoped to this game's id, so games cannot tread on each other.
   */
  readonly store: GameStore;
}

export interface GameInstance {
  /** The whole frame as one string. The runtime clears each line as it writes. */
  render(): string;
  onKey(key: string): void;
  /** Set to run onTick on a fixed interval. Every tick repaints. */
  tickMs?: number;
  onTick?(): void;
  /** Called when the game is left. Clear any timers here. */
  dispose?(): void;
}

export interface GameModule {
  /** Stable lowercase id, also the directory name. */
  id: string;
  /** Shown in the launcher. */
  title: string;
  /** One short line under the title in the launcher. */
  blurb: string;
  start(ctx: GameContext): GameInstance;
}
