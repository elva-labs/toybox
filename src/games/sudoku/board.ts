export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const CELLS = 81;

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

const PEERS: number[][] = Array.from({ length: CELLS }, (_, i) => {
  const peers: number[] = [];
  for (let j = 0; j < CELLS; j++) {
    if (j === i) continue;
    if (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i)) peers.push(j);
  }
  return peers;
});

export const peersOf = (i: number) => PEERS[i];

export const candidates = (grid: number[], i: number): number[] => {
  const used = new Set<number>();
  for (const p of PEERS[i]) if (grid[p] !== 0) used.add(grid[p]);
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
  return out;
};

const shuffle = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** Picks the empty cell with the fewest candidates. Returns -1 when the grid is full. */
const mostConstrained = (grid: number[]): { index: number; options: number[] } => {
  let index = -1;
  let options: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    const opts = candidates(grid, i);
    if (index === -1 || opts.length < options.length) {
      index = i;
      options = opts;
      if (opts.length <= 1) break;
    }
  }
  return { index, options };
};

const fillRandom = (grid: number[]): boolean => {
  const { index, options } = mostConstrained(grid);
  if (index === -1) return true;
  for (const d of shuffle(options)) {
    grid[index] = d;
    if (fillRandom(grid)) return true;
    grid[index] = 0;
  }
  return false;
};

/** Counts solutions, stopping once `limit` have been found. */
export const countSolutions = (grid: number[], limit: number): number => {
  const { index, options } = mostConstrained(grid);
  if (index === -1) return 1;
  let total = 0;
  for (const d of options) {
    grid[index] = d;
    total += countSolutions(grid, limit - total);
    grid[index] = 0;
    if (total >= limit) break;
  }
  return total;
};

export const solve = (grid: number[]): number[] | null => {
  const work = grid.slice();
  return fillRandom(work) ? work : null;
};

const CLUES: Record<Difficulty, number> = {
  easy: 45,
  medium: 36,
  hard: 30,
  expert: 25,
};

export const generate = (difficulty: Difficulty): { puzzle: number[]; solution: number[] } => {
  const solution = new Array<number>(CELLS).fill(0);
  fillRandom(solution);

  const puzzle = solution.slice();
  const target = CLUES[difficulty];
  let clues = CELLS;

  for (const i of shuffle([...Array(CELLS).keys()])) {
    if (clues <= target) break;
    const saved = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle.slice(), 2) === 1) clues--;
    else puzzle[i] = saved;
  }

  return { puzzle, solution };
};
