import {
  type Card,
  type Draw,
  PILES,
  type Table,
  cloneTable,
  dealTable,
  isRed,
  top,
} from './deck.js';

/** Where a move is coming from. Null is an empty hand. */
export type Held =
  | { kind: 'waste' }
  | { kind: 'foundation'; index: number }
  | { kind: 'tableau'; pile: number; index: number }
  | null;

/** Where a move is going. The stock and the flip take nothing back. */
export type Target = { kind: 'tableau'; pile: number } | { kind: 'foundation'; index: number };

/**
 * A place on the board in the board's own geometry: a top row of seven columns
 * -- deck, flip, a gap, four homes -- and the tableau below, where a column is
 * a pile and the cursor can rest on any card of it.
 */
export interface Cursor {
  row: 'top' | 'board';
  col: number;
  depth: number;
}

export interface Game {
  table: Table;
  held: Held;
  cursor: Cursor;
  /** The cursor appears once the keyboard asks for it. A fresh deal shows none. */
  cursorShown: boolean;
  history: Table[];
  /** The clock runs from the first move to the win, and nowhere else. */
  startedAt: number | null;
  finishedAt: number | null;
  message: string;
}

const HISTORY = 200;

/** The top row's occupied columns: the gap at column 2 holds nothing. */
export const TOP_COLS = [0, 1, 3, 4, 5, 6];
export const STOCK_COL = 0;
export const WASTE_COL = 1;
export const GAP_COL = 2;
export const FOUNDATION_COL = 3;

export const newGame = (number: number, draw: Draw): Game => ({
  table: dealTable(number, draw),
  held: null,
  cursor: { row: 'board', col: 0, depth: 0 },
  cursorShown: false,
  history: [],
  startedAt: null,
  finishedAt: null,
  message: '',
});

// ---- the rules ---------------------------------------------------------------

/** A foundation takes its suit's ace first, and then that suit in order. */
export const fitsFoundation = (card: Card, foundation: Card[]): boolean => {
  const under = top(foundation);
  if (!under) return card.rank === 1;
  return under.suit === card.suit && under.rank === card.rank - 1;
};

/** A tableau pile takes a king on nothing, and descending alternating colours. */
export const fitsTableau = (card: Card, pile: Card[]): boolean => {
  const under = top(pile);
  if (!under) return card.rank === 13;
  return under.up && isRed(under) !== isRed(card) && under.rank === card.rank + 1;
};

/** Whether the cards from `index` down form a run that moves as one. */
export const isRun = (pile: Card[], index: number): boolean => {
  if (index < 0 || index >= pile.length || !pile[index].up) return false;
  for (let i = index; i < pile.length - 1; i++) {
    const card = pile[i];
    const next = pile[i + 1];
    if (!next.up || isRed(card) === isRed(next) || card.rank !== next.rank + 1) return false;
  }
  return true;
};

/** The deepest card of a pile that can be picked up with everything below it. */
export const runStart = (pile: Card[]): number => {
  let index = pile.length - 1;
  while (index > 0 && isRun(pile, index - 1)) index--;
  return index;
};

/** The cards a hold is carrying, top of the run first in board order. */
export const heldCards = (table: Table, held: Held): Card[] => {
  if (!held) return [];
  if (held.kind === 'waste') {
    const card = top(table.waste);
    return card ? [card] : [];
  }
  if (held.kind === 'foundation') {
    const card = top(table.foundations[held.index]);
    return card ? [card] : [];
  }
  return table.tableau[held.pile].slice(held.index);
};

/** Take the held cards off the board. The caller has already placed them. */
const lift = (table: Table, held: Held) => {
  if (!held) return;
  if (held.kind === 'waste') {
    table.waste.pop();
    return;
  }
  if (held.kind === 'foundation') {
    table.foundations[held.index].pop();
    return;
  }
  const pile = table.tableau[held.pile];
  pile.length = held.index;
  // The card a moved run was sitting on turns face up.
  const exposed = top(pile);
  if (exposed && !exposed.up) exposed.up = true;
};

/**
 * One predicate for whether a move goes, so the board's highlighting and the
 * board's rules can never disagree about it.
 */
const legal = (table: Table, held: Held, target: Target): boolean => {
  const cards = heldCards(table, held);
  if (cards.length === 0) return false;
  if (target.kind === 'foundation') {
    // A foundation takes one card, and only ever the last of a run. Each home
    // belongs to the suit that labels it, so a card has exactly one.
    if (cards.length !== 1 || target.index !== cards[0].suit) return false;
    return fitsFoundation(cards[0], table.foundations[target.index]);
  }
  if (held?.kind === 'tableau' && held.pile === target.pile) return false;
  return fitsTableau(cards[0], table.tableau[target.pile]);
};

/** Play the held cards onto a target, or report that they do not go there. */
export const play = (table: Table, held: Held, target: Target): boolean => {
  if (!legal(table, held, target)) return false;
  const cards = heldCards(table, held);
  lift(table, held);
  if (target.kind === 'foundation') table.foundations[target.index].push(cards[0]);
  else table.tableau[target.pile].push(...cards);
  table.moves++;
  return true;
};

/** The foundation a single card belongs on, if it is ready for it. */
export const foundationFor = (table: Table, card: Card): number | null =>
  fitsFoundation(card, table.foundations[card.suit]) ? card.suit : null;

/** Turn cards from the stock, or turn the whole flip back over. */
export const drawStock = (table: Table): boolean => {
  if (table.stock.length > 0) {
    for (let i = 0; i < table.draw && table.stock.length > 0; i++) {
      const card = table.stock.pop() as Card;
      card.up = true;
      table.waste.push(card);
    }
    table.moves++;
    return true;
  }
  if (table.waste.length === 0) return false;
  while (table.waste.length > 0) {
    const card = table.waste.pop() as Card;
    card.up = false;
    table.stock.push(card);
  }
  table.moves++;
  return true;
};

/** Send every card that is ready to a foundation, until none is. */
export const autoplay = (table: Table): number => {
  let played = 0;
  for (let progress = true; progress; ) {
    progress = false;
    const sources: Held[] = [{ kind: 'waste' }];
    for (let pile = 0; pile < PILES; pile++) {
      const cards = table.tableau[pile];
      if (cards.length > 0) sources.push({ kind: 'tableau', pile, index: cards.length - 1 });
    }
    for (const source of sources) {
      const card = heldCards(table, source)[0];
      if (!card || !card.up) continue;
      const index = foundationFor(table, card);
      if (index === null) continue;
      play(table, source, { kind: 'foundation', index });
      played++;
      progress = true;
    }
  }
  return played;
};

export const won = (table: Table) => table.foundations.every((pile) => pile.length === 13);

// ---- the session -------------------------------------------------------------

export const elapsedMs = (game: Game) =>
  game.startedAt === null ? 0 : (game.finishedAt ?? Date.now()) - game.startedAt;

/** A game worth asking about before it is thrown away. */
export const liveRun = (game: Game) =>
  game.startedAt !== null && game.finishedAt === null && game.table.moves > 0;

/** Whatever the hold is carrying goes on this target. Drives the highlighting. */
export const canDrop = (game: Game, target: Target) => legal(game.table, game.held, target);

const clampCursor = (game: Game) => {
  if (game.cursor.row === 'top') {
    if (game.cursor.col === GAP_COL) game.cursor.col = WASTE_COL;
    return;
  }
  const pile = game.table.tableau[game.cursor.col];
  game.cursor.depth = Math.max(0, Math.min(game.cursor.depth, pile.length - 1));
};

const finish = (game: Game) => {
  if (game.startedAt === null) game.startedAt = Date.now();
  if (won(game.table) && game.finishedAt === null) game.finishedAt = Date.now();
};

const remember = (game: Game, before: Table) => {
  game.history.push(before);
  if (game.history.length > HISTORY) game.history.shift();
};

/** Run a move, keeping the board undoable and the hold consistent. */
const act = (game: Game, change: (table: Table) => boolean, note?: string): boolean => {
  const before = cloneTable(game.table);
  // Nothing below mutates before it knows the move goes, so a refused move
  // leaves the table exactly as it was and earns no history entry.
  if (!change(game.table)) {
    game.message = note ?? 'That card does not go there.';
    return false;
  }
  remember(game, before);
  game.held = null;
  game.message = '';
  finish(game);
  clampCursor(game);
  return true;
};

export const seat = (game: Game, row: 'top' | 'board', col: number, depth = 0) => {
  game.cursorShown = true;
  game.cursor = { row, col, depth };
  clampCursor(game);
};

/** Put the cursor on a pile's top card, which is what a pile key means by it. */
export const seatPile = (game: Game, pile: number) =>
  seat(game, 'board', pile, Math.max(0, game.table.tableau[pile].length - 1));

export const grab = (game: Game, next: Held) => {
  // Picking up what you are already holding puts it back.
  const held = game.held;
  const same =
    held !== null &&
    next !== null &&
    held.kind === next.kind &&
    (held.kind !== 'tableau' ||
      (next.kind === 'tableau' && held.pile === next.pile && held.index === next.index));
  game.held = same ? null : next;
  game.message = '';
};

/** Drop on a place, or -- holding nothing -- pick that place up instead. */
export const dropOn = (game: Game, target: Target) => {
  if (game.held) {
    // Its own pile takes a held stack back, so there is always a way to let go
    // without escape, which the launcher wants for itself.
    if (game.held.kind === 'tableau' && target.kind === 'tableau' && game.held.pile === target.pile) {
      grab(game, game.held);
      return;
    }
    act(game, (table) => play(table, game.held, target));
    return;
  }
  if (target.kind === 'foundation') {
    if (game.table.foundations[target.index].length > 0)
      grab(game, { kind: 'foundation', index: target.index });
    return;
  }
  const pile = game.table.tableau[target.pile];
  if (pile.length > 0) grab(game, { kind: 'tableau', pile: target.pile, index: runStart(pile) });
};

/**
 * Send the held card home, or -- holding nothing -- send everything that fits.
 * One key covers both because they are the same wish at different moments.
 */
export const sendHome = (game: Game) => {
  if (game.held) {
    const cards = heldCards(game.table, game.held);
    const index = cards.length === 1 ? foundationFor(game.table, cards[0]) : null;
    if (index === null) {
      game.message = 'That is not ready to go home.';
      return;
    }
    act(game, (table) => play(table, game.held, { kind: 'foundation', index }));
    return;
  }
  const before = cloneTable(game.table);
  const played = autoplay(game.table);
  if (played === 0) {
    game.message = 'Nothing is ready to go home.';
    return;
  }
  remember(game, before);
  finish(game);
  clampCursor(game);
  game.message = played === 1 ? 'One card sent home.' : `${played} cards sent home.`;
};

export const drawFromStock = (game: Game) => {
  act(game, drawStock, 'The deck and the flip are both empty.');
};

export const undoMove = (game: Game) => {
  const before = game.history.pop();
  if (!before) {
    game.message = 'Nothing to undo.';
    return;
  }
  game.table = before;
  game.held = null;
  game.message = '';
  clampCursor(game);
};

const firstUp = (pile: Card[]) => {
  const index = pile.findIndex((card) => card.up);
  return index < 0 ? Math.max(0, pile.length - 1) : index;
};

export const moveCursor = (game: Game, dx: number, dy: number) => {
  const { cursor } = game;
  game.message = '';
  game.cursorShown = true;
  if (dx !== 0) {
    if (cursor.row === 'top') {
      const at = TOP_COLS.indexOf(cursor.col);
      const col = TOP_COLS[(at + dx + TOP_COLS.length) % TOP_COLS.length];
      game.cursor = { row: 'top', col, depth: 0 };
      return;
    }
    const col = (cursor.col + dx + PILES) % PILES;
    game.cursor = { row: 'board', col, depth: Math.max(0, game.table.tableau[col].length - 1) };
    return;
  }
  if (cursor.row === 'top') {
    if (dy <= 0) return;
    const col = cursor.col === GAP_COL ? WASTE_COL : cursor.col;
    game.cursor = { row: 'board', col, depth: Math.max(0, game.table.tableau[col].length - 1) };
    return;
  }
  const pile = game.table.tableau[cursor.col];
  if (dy < 0) {
    // Up out of the shallowest face-up card lands on the row above, so the
    // whole board is reachable without ever leaving the arrows.
    if (pile.length === 0 || cursor.depth <= firstUp(pile)) {
      game.cursor = { row: 'top', col: cursor.col === GAP_COL ? WASTE_COL : cursor.col, depth: 0 };
    } else {
      game.cursor = { ...cursor, depth: cursor.depth - 1 };
    }
    return;
  }
  if (cursor.depth < pile.length - 1) game.cursor = { ...cursor, depth: cursor.depth + 1 };
};

/** Enter, wherever the cursor rests: pick up, drop, or draw. */
export const activate = (game: Game) => {
  const { cursor } = game;
  if (cursor.row === 'top') {
    if (cursor.col === STOCK_COL) {
      drawFromStock(game);
      return;
    }
    if (cursor.col === WASTE_COL) {
      if (game.held) {
        game.message = 'The flip takes nothing back.';
        return;
      }
      if (top(game.table.waste)) grab(game, { kind: 'waste' });
      return;
    }
    dropOn(game, { kind: 'foundation', index: cursor.col - FOUNDATION_COL });
    return;
  }
  if (game.held) {
    dropOn(game, { kind: 'tableau', pile: cursor.col });
    return;
  }
  const pile = game.table.tableau[cursor.col];
  if (pile.length === 0) return;
  const card = pile[cursor.depth];
  if (!card.up || !isRun(pile, cursor.depth)) {
    game.message = 'That card is not free to take.';
    return;
  }
  grab(game, { kind: 'tableau', pile: cursor.col, index: cursor.depth });
};
