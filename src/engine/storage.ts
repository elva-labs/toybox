import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * One JSON file for the whole arcade, with a key per game. Games never see the
 * file: they get a store scoped to their own id and read and write a single
 * value of whatever shape they like.
 */
const FILE = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
  'elva-cli-toybox',
  'state.json',
);

export const storePath = () => FILE;

type Bag = Record<string, unknown>;

let cache: Bag | null = null;

const readAll = (): Bag => {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(readFileSync(FILE, 'utf8'));
    cache = parsed && typeof parsed === 'object' ? (parsed as Bag) : {};
  } catch {
    // No file yet, or someone hand edited it into nonsense. Start clean.
    cache = {};
  }
  return cache;
};

const writeAll = (bag: Bag) => {
  cache = bag;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    // Write beside the target and move it into place, so a crash midway
    // cannot leave a half written file behind.
    const temp = `${FILE}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(bag, null, 2)}\n`, 'utf8');
    renameSync(temp, FILE);
  } catch {
    // Saving is a nicety. A read only home directory must not end the game.
  }
};

export interface GameStore {
  /** The saved value, or the fallback when nothing has been saved yet. */
  read<T>(fallback: T): T;
  /** Replaces the saved value. Cheap enough to call whenever it changes. */
  write(value: unknown): void;
}

export const storeFor = (id: string): GameStore => ({
  read: <T>(fallback: T): T => {
    const saved = readAll()[id];
    return saved === undefined ? fallback : (saved as T);
  },
  write: (value: unknown) => {
    writeAll({ ...readAll(), [id]: value });
  },
});
