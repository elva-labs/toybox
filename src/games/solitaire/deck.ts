/**
 * The fifty two cards, and the shuffle that turns a number into a deal. Every
 * deal has a number and the shuffle is seeded from it, so a game you liked --
 * or lost -- can be dealt again exactly.
 */

/** Foundation order. Hearts and diamonds are the red ones. */
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface Card {
  /** 1 (ace) through 13 (king). */
  rank: number;
  /** An index into SUITS. */
  suit: number;
  up: boolean;
}

/** How many cards a turn of the stock flips: klondike's one or three. */
export type Draw = 1 | 3;

export interface Table {
  /** The deal this game was shuffled from. */
  number: number;
  draw: Draw;
  stock: Card[];
  waste: Card[];
  /** One pile per suit, in SUITS order, each running up from its ace. */
  foundations: Card[][];
  tableau: Card[][];
  moves: number;
}

export const PILES = 7;
export const MAX_DEAL = 99999;

export const isRed = (card: Card) => card.suit === 1 || card.suit === 2;

export const top = <T>(cards: T[]): T | undefined => cards[cards.length - 1];

/** mulberry32: enough randomness for a shuffle, from a number you can keep. */
const random = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = (seed: number): Card[] => {
  const next = random(seed);
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit, up: false });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

/** Seven piles of one more card than the last, each showing its top card. */
export const dealTable = (number: number, draw: Draw): Table => {
  const deck = shuffled(number);
  const tableau: Card[][] = [];
  for (let pile = 0; pile < PILES; pile++) {
    const cards = deck.splice(0, pile + 1);
    cards[cards.length - 1].up = true;
    tableau.push(cards);
  }
  return {
    number,
    draw,
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    moves: 0,
  };
};

export const someDeal = () => Math.floor(Math.random() * MAX_DEAL) + 1;

/** A copy deep enough to hand to the undo stack. */
export const cloneTable = (table: Table): Table => {
  const pile = (cards: Card[]) => cards.map((card) => ({ ...card }));
  return {
    number: table.number,
    draw: table.draw,
    stock: pile(table.stock),
    waste: pile(table.waste),
    foundations: table.foundations.map(pile),
    tableau: table.tableau.map(pile),
    moves: table.moves,
  };
};
