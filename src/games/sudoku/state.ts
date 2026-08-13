import {
  CELLS,
  candidates,
  colOf,
  type Difficulty,
  generate,
  peersOf,
  rowOf,
} from './board.js';

interface Snapshot {
  index: number;
  value: number;
  notes: number[];
}

export interface Game {
  difficulty: Difficulty;
  puzzle: number[];
  solution: number[];
  values: number[];
  notes: Set<number>[];
  cursor: number;
  noteMode: boolean;
  undo: Snapshot[];
  hints: number;
  startedAt: number;
  finishedAt: number | null;
  message: string;
}

export const newGame = (difficulty: Difficulty): Game => {
  const { puzzle, solution } = generate(difficulty);
  return {
    difficulty,
    puzzle,
    solution,
    values: puzzle.slice(),
    notes: Array.from({ length: CELLS }, () => new Set<number>()),
    cursor: puzzle.findIndex((v) => v === 0),
    noteMode: false,
    undo: [],
    hints: 0,
    startedAt: Date.now(),
    finishedAt: null,
    message: '',
  };
};

export const isGiven = (game: Game, index: number) => game.puzzle[index] !== 0;

export const isSolved = (game: Game) => game.values.every((v, i) => v === game.solution[i]);

/** An entry that does not match the solution. Shown in red as you type. */
export const isWrong = (game: Game, index: number) =>
  game.values[index] !== 0 && game.values[index] !== game.solution[index];

export const elapsedMs = (game: Game) => (game.finishedAt ?? Date.now()) - game.startedAt;

export const remainingOf = (game: Game, digit: number) =>
  9 - game.values.filter((v) => v === digit).length;

const record = (game: Game, index: number) => {
  game.undo.push({ index, value: game.values[index], notes: [...game.notes[index]] });
  if (game.undo.length > 500) game.undo.shift();
};

export const moveCursor = (game: Game, dRow: number, dCol: number) => {
  const row = Math.min(8, Math.max(0, rowOf(game.cursor) + dRow));
  const col = Math.min(8, Math.max(0, colOf(game.cursor) + dCol));
  game.cursor = row * 9 + col;
};

export const setDigit = (game: Game, digit: number) => {
  const i = game.cursor;
  if (isGiven(game, i)) {
    game.message = 'that cell is a given';
    return;
  }
  record(game, i);
  if (game.noteMode) {
    if (game.values[i] !== 0) game.values[i] = 0;
    if (game.notes[i].has(digit)) game.notes[i].delete(digit);
    else game.notes[i].add(digit);
    return;
  }
  game.values[i] = game.values[i] === digit ? 0 : digit;
  if (game.values[i] !== 0) {
    game.notes[i].clear();
    for (const p of peersOf(i)) game.notes[p].delete(digit);
  }
};

export const clearCell = (game: Game) => {
  const i = game.cursor;
  if (isGiven(game, i)) {
    game.message = 'that cell is a given';
    return;
  }
  if (game.values[i] === 0 && game.notes[i].size === 0) return;
  record(game, i);
  game.values[i] = 0;
  game.notes[i].clear();
};

export const undoMove = (game: Game) => {
  const last = game.undo.pop();
  if (!last) {
    game.message = 'nothing to undo';
    return;
  }
  game.values[last.index] = last.value;
  game.notes[last.index] = new Set(last.notes);
  game.cursor = last.index;
};

export const fillNotes = (game: Game) => {
  for (let i = 0; i < CELLS; i++) {
    if (game.values[i] !== 0) continue;
    game.notes[i] = new Set(candidates(game.values, i));
  }
  game.message = 'pencil marks filled';
};

export const hint = (game: Game) => {
  const i = game.cursor;
  if (game.values[i] === game.solution[i]) {
    game.message = 'that cell is already correct';
    return;
  }
  record(game, i);
  game.values[i] = game.solution[i];
  game.notes[i].clear();
  game.hints++;
  game.message = 'hint used';
};
