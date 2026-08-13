import {
  BG_GREEN,
  BG_GREY,
  BG_YELLOW,
  BOLD,
  DIM,
  GREEN,
  MAGENTA,
  WHITE,
  YELLOW,
  centre,
  pad,
  paint,
  width,
} from '../../engine/ansi.js';
import {
  type Game,
  MAX_GUESSES,
  type Mark,
  WORD_LENGTH,
  letterStates,
} from './state.js';

/** Content column the grid, status and keyboard centre on, and the header right aligns to. */
const PANEL_WIDTH = 43;
const BOX_INNER = WORD_LENGTH * 4 + 3;

const MARK_BACKGROUND: Record<Mark, string> = {
  green: BG_GREEN,
  yellow: BG_YELLOW,
  grey: BG_GREY,
};

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const key = (letter: string, mark: Mark | undefined) =>
  mark
    ? paint(` ${letter.toUpperCase()} `, MARK_BACKGROUND[mark], WHITE, BOLD)
    : paint(` ${letter.toUpperCase()} `, WHITE);

const tile = (letter: string, mark: Mark | undefined) => {
  if (mark) return paint(` ${letter.toUpperCase()} `, MARK_BACKGROUND[mark], WHITE, BOLD);
  if (!letter) return paint(' _ ', DIM);
  return paint(` ${letter.toUpperCase()} `, BOLD, WHITE);
};

const rowTiles = (game: Game, row: number): string => {
  const guess = game.guesses[row];
  const typed = row === game.guesses.length ? game.current : '';
  const cells: string[] = [];

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess) cells.push(tile(guess.word[i], guess.marks[i]));
    else cells.push(tile(typed[i] ?? '', undefined));
  }

  return cells.join(' ');
};

const gridLines = (game: Game): string[] => {
  const border = '─'.repeat(BOX_INNER);
  const lines = [`┌${border}┐`];
  for (let row = 0; row < MAX_GUESSES; row++) lines.push(`│  ${rowTiles(game, row)}  │`);
  lines.push(`└${border}┘`);
  return lines;
};

const keyboardLines = (game: Game): string[] => {
  const states = letterStates(game);
  return KEYBOARD_ROWS.map((row) =>
    centre([...row].map((letter) => key(letter, states.get(letter))).join(''), PANEL_WIDTH),
  );
};

const header = (game: Game) => {
  const left = paint('WORDLE', BOLD, MAGENTA);
  const used = Math.min(game.guesses.length + 1, MAX_GUESSES);
  const right =
    game.status === 'playing'
      ? paint(`guess ${used}/${MAX_GUESSES}`, DIM)
      : paint(`${game.guesses.length}/${MAX_GUESSES} used`, DIM);
  return `  ${pad(left, PANEL_WIDTH - width(right))}${right}`;
};

const statusLine = (game: Game) => {
  if (game.status === 'won') {
    const count = game.guesses.length;
    return paint(`got it in ${count} guess${count === 1 ? '' : 'es'}`, BOLD, GREEN);
  }
  if (game.status === 'lost') {
    return `out of guesses, it was ${paint(game.answer.toUpperCase(), BOLD)}`;
  }
  return game.message ? paint(game.message, YELLOW) : '';
};

// Every letter has to stay typable, so escape is the only way out of a round.
const HELP_PLAYING = [
  `${paint('type', DIM)} a-z   ${paint('delete', DIM)} backspace   ${paint('guess', DIM)} enter`,
  `${paint('back', DIM)} escape`,
];
const HELP_OVER = [
  `${paint('n', BOLD)} or ${paint('enter', BOLD)} new round   ${paint('escape', BOLD)} back`,
  '',
];

export const renderGame = (game: Game): string => {
  const status = statusLine(game);
  const lines = [
    header(game),
    '',
    ...gridLines(game).map((line) => `  ${centre(line, PANEL_WIDTH)}`),
    '',
    status ? `  ${centre(status, PANEL_WIDTH)}` : '',
    '',
    ...keyboardLines(game).map((line) => `  ${line}`),
    '',
    ...(game.status === 'playing' ? HELP_PLAYING : HELP_OVER).map((line) => `  ${line}`),
  ];
  return lines.join('\n');
};
