import {
  BOLD,
  CYAN,
  DIM,
  GREEN,
  INVERSE,
  MAGENTA,
  RED,
  WHITE,
  YELLOW,
  pad,
  paint,
} from '../../engine/ansi.js';
import { type Game, elapsedMs, isGiven, isWrong, remainingOf } from './state.js';
import { type Difficulty, colOf, rowOf } from './board.js';

const BOARD_WIDTH = 25;
const PANEL_COLUMN = BOARD_WIDTH + 6;

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export const formatTime = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const mins = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

const cellText = (game: Game, index: number) => {
  const value = game.values[index];
  const cursorValue = game.values[game.cursor];
  const isCursor = index === game.cursor;
  const sameDigit = cursorValue !== 0 && value === cursorValue;
  const notedDigit = cursorValue !== 0 && value === 0 && game.notes[index].has(cursorValue);

  let glyph: string;
  let codes: string[];

  if (value === 0) {
    const hasNotes = game.notes[index].size > 0;
    glyph = hasNotes ? '∘' : '·';
    codes = notedDigit ? [YELLOW, BOLD] : hasNotes ? [YELLOW, DIM] : [DIM];
  } else {
    glyph = String(value);
    if (isWrong(game, index)) codes = [RED, BOLD];
    else if (sameDigit && !isCursor) codes = [YELLOW, BOLD];
    else if (isGiven(game, index)) codes = [BOLD, WHITE];
    else codes = [CYAN];
  }

  if (isCursor) return paint(glyph, INVERSE, ...codes.filter((c) => c !== DIM));
  return paint(glyph, ...codes);
};

const boardLines = (game: Game): string[] => {
  const segment = '─'.repeat(7);
  const lines: string[] = [`┌${segment}┬${segment}┬${segment}┐`];

  for (let row = 0; row < 9; row++) {
    const groups: string[] = [];
    for (let group = 0; group < 3; group++) {
      const cells: string[] = [];
      for (let offset = 0; offset < 3; offset++) {
        cells.push(cellText(game, row * 9 + group * 3 + offset));
      }
      groups.push(cells.join(' '));
    }
    lines.push(`│ ${groups.join(' │ ')} │`);
    if (row === 2 || row === 5) lines.push(`├${segment}┼${segment}┼${segment}┤`);
  }

  lines.push(`└${segment}┴${segment}┴${segment}┘`);
  return lines;
};

const notePadLines = (game: Game): string[] => {
  const notes = game.notes[game.cursor];
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells: string[] = [];
    for (let c = 0; c < 3; c++) {
      const digit = r * 3 + c + 1;
      cells.push(notes.has(digit) ? paint(String(digit), YELLOW) : paint('·', DIM));
    }
    rows.push(`│ ${cells.join(' ')} │`);
  }
  return ['┌───────┐', ...rows, '└───────┘'];
};

const panelLines = (game: Game): string[] => {
  const cursorLabel = `r${rowOf(game.cursor) + 1}c${colOf(game.cursor) + 1}`;
  const remaining: string[] = [];
  for (let start = 1; start <= 9; start += 3) {
    const parts: string[] = [];
    for (let digit = start; digit < start + 3; digit++) {
      const left = remainingOf(game, digit);
      const text = `${digit}:${left}`;
      parts.push(left === 0 ? paint(text, DIM) : text);
    }
    remaining.push(parts.join('  '));
  }

  return [
    game.noteMode ? paint(' NOTES ', INVERSE, YELLOW) : paint('normal', DIM),
    '',
    paint(`pencil marks ${cursorLabel}`, DIM),
    ...notePadLines(game),
    '',
    paint('digits left', DIM),
    ...remaining,
  ];
};

const withPanel = (left: string[], right: string[]): string[] => {
  const height = Math.max(left.length, right.length);
  const out: string[] = [];
  for (let i = 0; i < height; i++) {
    const board = left[i] ?? '';
    const panel = right[i] ?? '';
    out.push(panel ? `${pad(`  ${board}`, PANEL_COLUMN)}${panel}` : `  ${board}`);
  }
  return out;
};

const header = (game: Game) => {
  const left = `${paint('SUDOKU', BOLD, MAGENTA)}  ${paint(game.difficulty, DIM)}`;
  const right = `${formatTime(elapsedMs(game))}   ${paint(`hints ${game.hints}`, DIM)}`;
  return `  ${pad(left, PANEL_COLUMN - 2)}${right}`;
};

const HELP = [
  `${paint('move', DIM)} arrows/hjkl   ${paint('place', DIM)} 1-9   ${paint('erase', DIM)} 0 space backspace`,
  `${paint('notes', DIM)} n   ${paint('fill notes', DIM)} a   ${paint('undo', DIM)} u   ${paint('hint', DIM)} H   ${paint('new', DIM)} N   ${paint('back', DIM)} q`,
];

export const renderGame = (game: Game): string => {
  const lines = [header(game), '', ...withPanel(boardLines(game), panelLines(game)), ''];

  if (game.message) lines.push(`  ${paint(game.message, YELLOW)}`);
  else lines.push('');

  lines.push('', ...HELP.map((line) => `  ${line}`));
  return lines.join('\n');
};

export const renderWon = (game: Game): string => {
  const lines = [
    header(game),
    '',
    ...withPanel(boardLines(game), []),
    '',
    `  ${paint('solved', BOLD, GREEN)} in ${paint(formatTime(elapsedMs(game)), BOLD)} on ${game.difficulty}${
      game.hints > 0 ? paint(`  (${game.hints} hint${game.hints === 1 ? '' : 's'})`, DIM) : ''
    }`,
    '',
    `  ${paint('N', BOLD)} new game    ${paint('q', BOLD)} back`,
  ];
  return lines.join('\n');
};

export const renderMenu = (selected: number): string => {
  const lines = [
    '',
    `  ${paint('SUDOKU', BOLD, MAGENTA)}`,
    '',
    `  ${paint('pick a difficulty', DIM)}`,
    '',
  ];

  DIFFICULTIES.forEach((difficulty, i) => {
    const label = `${i + 1}  ${difficulty}`;
    lines.push(`    ${i === selected ? paint(` ${label} `, INVERSE) : `  ${label}`}`);
  });

  lines.push(
    '',
    `  ${paint('up/down or 1-4 to choose, enter to start, q to go back', DIM)}`,
    '',
  );
  return lines.join('\n');
};

export const renderGenerating = (difficulty: Difficulty): string =>
  `\n  ${paint('SUDOKU', BOLD, MAGENTA)}\n\n  ${paint(`generating ${difficulty} puzzle...`, DIM)}\n`;
