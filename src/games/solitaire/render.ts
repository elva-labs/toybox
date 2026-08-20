import { BOLD, DIM, MAGENTA, RESET, YELLOW, pad, paint, width } from '../../engine/ansi.js';
import { type Card, PILES, RANKS, SUITS, isRed, top } from './deck.js';
import {
  FOUNDATION_COL,
  type Game,
  STOCK_COL,
  WASTE_COL,
  canDrop,
  elapsedMs,
} from './state.js';

/** What a run is worth keeping between sessions, already resolved for the mode. */
export interface Stats {
  played: number;
  won: number;
  /** The best time on this draw mode, in milliseconds. */
  best: number | null;
}

/**
 * A card is a filled plate rather than text on the background, so the board
 * reads as objects on a table. The fields are 256 colour, because the sixteen
 * a terminal picks its own shades for are the ones a card cannot afford to
 * have redefined under it.
 */
const FACE = '\x1b[48;5;254m\x1b[38;5;235m';
const FACE_RED = '\x1b[48;5;254m\x1b[38;5;160m';
const BACK = '\x1b[48;5;24m\x1b[38;5;68m';
const HELD = '\x1b[48;5;179m\x1b[38;5;235m';
const HELD_RED = '\x1b[48;5;179m\x1b[38;5;88m';
const CURSOR = '\x1b[48;5;221m\x1b[38;5;235m';
const CURSOR_RED = '\x1b[48;5;221m\x1b[38;5;124m';
const CURSOR_BACK = '\x1b[48;5;221m\x1b[38;5;24m';
const DROP = '\x1b[48;5;108m\x1b[38;5;235m';
const DROP_RED = '\x1b[48;5;108m\x1b[38;5;88m';
const SLOT = '\x1b[38;5;65m';
const SLOT_DROP = '\x1b[38;5;150m';
const SLOT_CURSOR = '\x1b[48;5;221m\x1b[38;5;94m';
const LABEL = '\x1b[38;5;65m';
const LABEL_ON = '\x1b[38;5;221m\x1b[1m';
const GOLD = '\x1b[38;5;221m';

const TL = '▛';
const TR = '▜';
const BL = '▙';
const BR = '▟';
const T = '▀';
const B = '▄';
const L = '▌';
const R = '▐';
const MOTIF = '♦';
const TURN = '↻';
const STAR = '★';
/** Rows a pile had to give up, marked where they were taken from. */
const MORE = '▴';

/** How far a fanned flip card sits out from the one over it. */
const FAN = 2;

interface Tier {
  width: number;
  height: number;
  gap: number;
}

const TIERS: Record<'small' | 'medium' | 'large', Tier> = {
  small: { width: 3, height: 3, gap: 1 },
  medium: { width: 5, height: 3, gap: 2 },
  large: { width: 7, height: 5, gap: 3 },
};

const boardWidth = (t: Tier) => PILES * t.width + (PILES - 1) * t.gap;

/**
 * Height decides as much as width does. A tall card is only worth having when
 * there are rows to spare underneath it, because the tableau is what runs out
 * of room first.
 */
const pickTier = (cols: number, rows: number): Tier => {
  if (cols >= boardWidth(TIERS.large) + 4 && rows >= 32) return TIERS.large;
  if (cols >= boardWidth(TIERS.medium) + 4 && rows >= 20) return TIERS.medium;
  return TIERS.small;
};

const middle = (text: string, to: number) => {
  const slack = Math.max(0, to - width(text));
  const left = Math.floor(slack / 2);
  return ' '.repeat(left) + text + ' '.repeat(slack - left);
};

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// ---- the cards ---------------------------------------------------------------

interface Marks {
  held?: boolean;
  cursor?: boolean;
  drop?: boolean;
}

/**
 * A held or hovered card keeps its suit's colour -- losing it is disorienting
 * when the colour is what the next move is chosen by -- and changes its field.
 */
const skin = (card: Card, marks: Marks): string => {
  if (!card.up) return marks.cursor ? CURSOR_BACK : BACK;
  const red = isRed(card);
  if (marks.cursor) return red ? CURSOR_RED : CURSOR;
  if (marks.held) return red ? HELD_RED : HELD;
  if (marks.drop) return red ? DROP_RED : DROP;
  return red ? FACE_RED : FACE;
};

/**
 * A card back: a plate with solid half block rails and one motif at the centre,
 * the way a printed back reads. A covered card shows the plate's top rule, so a
 * pile of backs is ruled lines rather than pattern noise.
 */
const backRows = (t: Tier): string[] =>
  Array.from({ length: t.height }, (_, row) => {
    if (row === 0) return TL + T.repeat(t.width - 2) + TR;
    if (row === t.height - 1) return BL + B.repeat(t.width - 2) + BR;
    const inner = Array.from({ length: t.width - 2 }, (_, col) =>
      row === (t.height - 1) >> 1 && col === (t.width - 3) >> 1 ? MOTIF : ' ',
    ).join('');
    return L + inner + R;
  });

/**
 * A card's face: its index across the top left, its suit at the centre on any
 * card wide enough to carry one, and the mirrored index -- suit then rank --
 * reading into the bottom right corner, which is the rotational symmetry a
 * real card's two indices have.
 */
const faceRows = (card: Card, t: Tier): string[] => {
  if (!card.up) return backRows(t);
  const grid = Array.from({ length: t.height }, () => Array.from({ length: t.width }, () => ' '));
  const index = `${RANKS[card.rank - 1]}${SUITS[card.suit]}`;
  for (let i = 0; i < index.length && i < t.width; i++) grid[0][i] = index[i];
  if (t.width > 3) grid[(t.height - 1) >> 1][(t.width - 1) >> 1] = SUITS[card.suit];
  const corner = `${SUITS[card.suit]}${RANKS[card.rank - 1]}`;
  for (let i = 0; i < corner.length; i++) {
    grid[t.height - 1][t.width - corner.length + i] = corner[i];
  }
  return grid.map((row) => row.join(''));
};

/** `take` rows of a card. A covered card takes one: its index row. */
const cardLines = (card: Card, t: Tier, marks: Marks, take = t.height): string[] => {
  const code = skin(card, marks);
  return faceRows(card, t)
    .slice(0, Math.max(1, take))
    .map((row) => `${code}${row}${RESET}`);
};

/** A fanned flip card, showing the leftmost columns of its index. */
const sliverLines = (card: Card, t: Tier): string[] => {
  const code = skin(card, {});
  return faceRows(card, t).map((row) => `${code}${row.slice(0, FAN)}${RESET}`);
};

/** An empty place: the deck's turnover arrow, or a suit's home. */
const slotLines = (t: Tier, mark: string, marks: Marks): string[] => {
  const code = marks.cursor ? SLOT_CURSOR : marks.drop ? SLOT_DROP : SLOT;
  const inner = t.width - 2;
  return Array.from({ length: t.height }, (_, row) => {
    if (row === 0) return `${code}┌${'─'.repeat(inner)}┐${RESET}`;
    if (row === t.height - 1) return `${code}└${'─'.repeat(inner)}┘${RESET}`;
    const body = row === (t.height - 1) >> 1 ? middle(mark, inner) : ' '.repeat(inner);
    return `${code}│${body}│${RESET}`;
  });
};

/** The face down prefix of a pile, collapsed to one counted rule. */
const bandLine = (count: number, t: Tier) =>
  `${BACK}${TL}${middle(String(count), t.width - 2)}${TR}${RESET}`;

const moreLine = (t: Tier) => `${LABEL}${MORE.repeat(t.width)}${RESET}`;

/** Blocks side by side, each padded to its own width, top aligned. */
const columns = (blocks: string[][], widths: number[], gap: number): string[] => {
  const height = Math.max(...blocks.map((block) => block.length));
  const spacer = ' '.repeat(gap);
  const lines: string[] = [];
  for (let row = 0; row < height; row++) {
    lines.push(
      blocks
        .map((block, i) => {
          const line = block[row] ?? '';
          return line + ' '.repeat(Math.max(0, widths[i] - width(line)));
        })
        .join(spacer),
    );
  }
  return lines;
};

// ---- the board ---------------------------------------------------------------

const onTop = (game: Game, col: number) =>
  game.cursorShown && game.cursor.row === 'top' && game.cursor.col === col;

const stockLines = (game: Game, t: Tier): string[] => {
  const cursor = onTop(game, STOCK_COL);
  if (game.table.stock.length === 0) {
    return slotLines(t, game.table.waste.length > 0 ? TURN : '', { cursor });
  }
  const code = cursor ? CURSOR_BACK : BACK;
  return backRows(t).map((row) => `${code}${row}${RESET}`);
};

const wasteLines = (game: Game, t: Tier): string[] => {
  const cursor = onTop(game, WASTE_COL);
  const waste = game.table.waste;
  if (waste.length === 0) return slotLines(t, '', { cursor });
  // Three card draw fans its last three; only the top one is playable, and the
  // two behind it are there to be read, so they show their indices and no more.
  const fan = game.table.draw === 3 ? Math.min(3, waste.length) : 1;
  const shown = waste.slice(waste.length - fan);
  const held = game.held?.kind === 'waste';
  const last = shown.length - 1;
  return columns(
    shown.map((card, i) => (i === last ? cardLines(card, t, { cursor, held }) : sliverLines(card, t))),
    shown.map((_, i) => (i === last ? t.width : FAN)),
    0,
  );
};

const foundationLines = (game: Game, suit: number, t: Tier): string[] => {
  const pile = game.table.foundations[suit];
  const cursor = onTop(game, FOUNDATION_COL + suit);
  const drop = game.held !== null && canDrop(game, { kind: 'foundation', index: suit });
  const card = top(pile);
  if (!card) return slotLines(t, SUITS[suit], { cursor, drop });
  const held = game.held?.kind === 'foundation' && game.held.index === suit;
  return cardLines(card, t, { cursor, drop, held });
};

const topLines = (game: Game, t: Tier): string[] => {
  const span = 2 * t.width + t.gap;
  const blocks = [stockLines(game, t), wasteLines(game, t)];
  const widths = [t.width, span];
  for (let suit = 0; suit < 4; suit++) {
    blocks.push(foundationLines(game, suit, t));
    widths.push(t.width);
  }
  return columns(blocks, widths, t.gap);
};

/** The keys the deck and the flip answer to, each over the card it belongs to. */
const hintLine = (t: Tier): string => {
  const deck = t.width >= 7 ? '[space]' : t.width >= 5 ? '[spc]' : 'spc';
  const flip = t.width >= 7 ? '[0]/[f]' : t.width >= 5 ? '[0/f]' : '0/f';
  return `${LABEL}${middle(deck, t.width)}${RESET}${' '.repeat(t.gap)}${LABEL}${middle(flip, t.width)}${RESET}`;
};

/** The keys the piles answer to, over the piles they answer for. */
const numberLine = (game: Game, t: Tier): string => {
  const cells: string[] = [];
  for (let pile = 0; pile < PILES; pile++) {
    const on = game.held !== null && canDrop(game, { kind: 'tableau', pile });
    cells.push(`${on ? LABEL_ON : LABEL}${middle(String(pile + 1), t.width)}${RESET}`);
  }
  return cells.join(' '.repeat(t.gap));
};

/**
 * A pile drawn as a stack: every covered card shows its index row alone and the
 * top card is drawn whole. A pile taller than the board has room for gives
 * ground in the order that costs the player least. The face down prefix
 * collapses to one counted rule first, because a face down card is not playable
 * and nothing is lost by counting it; then the top card loses height, which
 * costs it only its second index; and only then are the deepest rows dropped.
 */
const pileLines = (game: Game, index: number, t: Tier, budget: number): string[] => {
  const pile = game.table.tableau[index];
  const drop = game.held !== null && canDrop(game, { kind: 'tableau', pile: index });
  const onCol = game.cursorShown && game.cursor.row === 'board' && game.cursor.col === index;
  if (pile.length === 0) return slotLines(t, '', { drop, cursor: onCol });

  const upAt = pile.findIndex((card) => card.up);
  const down = upAt < 0 ? pile.length : upAt;
  const up = pile.length - down;

  let band = false;
  let cardH = t.height;
  const covered = () => (band ? 1 + Math.max(0, up - 1) : pile.length - 1);
  const height = () => covered() + cardH;
  if (height() > budget && down >= 2 && up >= 1) band = true;
  if (height() > budget) cardH = Math.max(1, cardH - (height() - budget));

  const lines: string[] = [];
  let i = 0;
  if (band) {
    lines.push(bandLine(down, t));
    i = down;
  }
  for (; i < pile.length; i++) {
    lines.push(
      ...cardLines(
        pile[i],
        t,
        {
          // Only the card you would land on, which is the one that matters.
          drop: drop && i === pile.length - 1,
          held:
            game.held?.kind === 'tableau' && game.held.pile === index && i >= game.held.index,
          cursor: onCol && game.cursor.depth === i,
        },
        i === pile.length - 1 ? cardH : 1,
      ),
    );
  }

  // The band survives the clip: it is the only thing left saying how many cards
  // are face down under all this, and it costs one row to keep.
  const from = band ? 1 : 0;
  if (lines.length > budget) lines.splice(from, lines.length - budget + 1, moreLine(t));
  return lines;
};

const tableauLines = (game: Game, t: Tier, budget: number): string[] => {
  const blocks: string[][] = [];
  for (let pile = 0; pile < PILES; pile++) blocks.push(pileLines(game, pile, t, budget));
  return columns(
    blocks,
    blocks.map(() => t.width),
    t.gap,
  );
};

// ---- the frame ---------------------------------------------------------------

const headerLine = (game: Game, bw: number): string => {
  const left = `${paint('SOLITAIRE', BOLD, MAGENTA)} ${paint(`#${game.table.number}`, DIM)}`;
  const right =
    bw >= 40
      ? `${clock(elapsedMs(game))}  ${paint(`${game.table.moves} moves`, DIM)}`
      : clock(elapsedMs(game));
  return pad(left, Math.max(0, bw - width(right))) + right;
};

const HELP_WIDE = [
  `${paint('move', DIM)} arrows/hjkl   ${paint('take & drop', DIM)} enter   ${paint('draw', DIM)} space   ${paint('pile', DIM)} 1-7   ${paint('flip', DIM)} 0/f`,
  `${paint('home', DIM)} a   ${paint('undo', DIM)} u   ${paint('new deal', DIM)} N   ${paint('retry', DIM)} r   ${paint('back', DIM)} q`,
];

const HELP_NARROW = [
  `${paint('move', DIM)} arrows   ${paint('act', DIM)} enter   ${paint('draw', DIM)} space   ${paint('pile', DIM)} 1-7`,
  `${paint('flip', DIM)} 0/f   ${paint('home', DIM)} a   ${paint('undo', DIM)} u   ${paint('new', DIM)} N   ${paint('back', DIM)} q`,
];

const WON_HELP = [
  `${paint('new deal', DIM)} N   ${paint('retry this deal', DIM)} r   ${paint('back', DIM)} q`,
];

const fits = (lines: string[], avail: number) => lines.every((line) => width(line) <= avail);

const wonBanner = (game: Game, stats: Stats): string => {
  const time = clock(elapsedMs(game));
  const record = stats.best !== null && elapsedMs(game) <= stats.best;
  const tail = record
    ? paint(`  ${STAR} best`, BOLD, YELLOW)
    : stats.best === null
      ? ''
      : paint(`  (best ${clock(stats.best)})`, DIM);
  return `${paint('solved', BOLD, YELLOW)} in ${paint(time, BOLD)} and ${game.table.moves} moves${tail}`;
};

/** Nothing sensible fits, so say what would help instead of tearing the frame. */
const needsRoom = (what: string) =>
  `\n  ${paint('SOLITAIRE', BOLD, MAGENTA)}\n\n  ${paint(`needs a ${what} window`, DIM)}`;

export const renderBoard = (
  game: Game,
  stats: Stats,
  confirming: string | null,
  cols: number,
  rows: number,
): string => {
  const t = pickTier(cols, rows);
  const bw = boardWidth(t);
  if (cols < bw) return needsRoom('wider');
  // Centred where there is room to centre it, and flush left where there is not.
  const indent = ' '.repeat(Math.floor((cols - bw) / 2));
  const avail = cols - indent.length;
  const finished = game.finishedAt !== null;

  let help = finished ? WON_HELP : fits(HELP_WIDE, avail) ? HELP_WIDE : HELP_NARROW;
  if (!fits(help, avail)) help = [];
  let spacers = true;
  let hints = true;

  // What this board actually needs, not what a board could: most deals never
  // grow a pile worth spending the trimmings on.
  const need = Math.max(
    ...game.table.tableau.map((pile) => Math.max(pile.length - 1, 0) + t.height),
  );
  // The runtime writes a newline after the frame, so one row is always spoken for.
  const rowsLeft = () =>
    rows -
    1 -
    (1 +
      (spacers ? 2 : 0) +
      t.height +
      (hints ? 1 : 0) +
      1 +
      1 +
      (help.length > 0 ? help.length + 1 : 0));

  // Give up the trimmings in the order they are least missed, and only as far
  // as the board needs: a compressed pile costs the player a move, and a
  // missing help line costs them nothing they cannot get back by looking.
  let budget = rowsLeft();
  if (budget < need && help.length > 0) {
    help = [];
    budget = rowsLeft();
  }
  if (budget < t.height && spacers) {
    spacers = false;
    budget = rowsLeft();
  }
  if (budget < t.height && hints) {
    hints = false;
    budget = rowsLeft();
  }
  if (budget < 1) return needsRoom('taller');

  const lines = [`${indent}${headerLine(game, bw)}`];
  if (spacers) lines.push('');
  lines.push(...topLines(game, t).map((line) => `${indent}${line}`));
  if (hints) lines.push(`${indent}${hintLine(t)}`);
  lines.push(`${indent}${numberLine(game, t)}`);
  lines.push(...tableauLines(game, t, budget).map((line) => `${indent}${line}`));
  if (spacers) lines.push('');

  if (confirming) lines.push(`${indent}${GOLD}${confirming}${RESET}`);
  else if (finished) lines.push(`${indent}${wonBanner(game, stats)}`);
  else lines.push(`${indent}${game.message ? paint(game.message, YELLOW) : ''}`);

  if (help.length > 0) lines.push('', ...help.map((line) => `${indent}${line}`));
  return lines.join('\n');
};

export const renderMenu = (seed: string, draw: 1 | 3, stats: Stats): string => {
  const option = (value: 1 | 3, label: string) =>
    `      ${draw === value ? `${LABEL_ON}▸ ${label}${RESET}` : paint(`  ${label}`, DIM)}`;

  const lines = [
    '',
    `  ${paint('SOLITAIRE', BOLD, MAGENTA)}`,
    '',
    `  ${paint('draw', DIM)}`,
    option(1, 'one card'),
    option(3, 'three cards'),
    '',
    `  ${paint('deal', DIM)}    ${seed ? paint(`#${seed}`, BOLD) : paint('#any', DIM)}`,
    `  ${paint('type a number to name the deal, or leave it for any deal', DIM)}`,
    '',
    `  ${paint('up/down or d', BOLD)} change the draw   ${paint('enter', BOLD)} deal   ${paint('q', BOLD)} back`,
    '',
  ];

  if (stats.played > 0) {
    const best = stats.best === null ? '' : ` ${paint('·', DIM)} best ${clock(stats.best)}`;
    lines.push(
      `  ${paint(`won ${stats.won} of ${stats.played} on this draw`, DIM)}${paint(best, DIM)}`,
      '',
    );
  }
  return lines.join('\n');
};
