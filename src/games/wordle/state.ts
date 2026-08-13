import { ACCEPTED, ANSWERS } from './words.js';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type Mark = 'green' | 'yellow' | 'grey';

export interface Guess {
  word: string;
  marks: Mark[];
}

export interface Game {
  answer: string;
  guesses: Guess[];
  current: string;
  status: 'playing' | 'won' | 'lost';
  message: string;
}

const acceptedSet = new Set(ACCEPTED);

export const isAccepted = (word: string) => acceptedSet.has(word);

/**
 * Count based marking. Greens claim their copy of the letter first, so a later
 * duplicate only turns yellow while unclaimed copies are left in the answer.
 */
export const markGuess = (guess: string, answer: string): Mark[] => {
  const marks: Mark[] = Array(WORD_LENGTH).fill('grey');
  const left = new Map<string, number>();

  for (const letter of answer) left.set(letter, (left.get(letter) ?? 0) + 1);

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] !== answer[i]) continue;
    marks[i] = 'green';
    left.set(guess[i], (left.get(guess[i]) ?? 0) - 1);
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === 'green') continue;
    const remaining = left.get(guess[i]) ?? 0;
    if (remaining <= 0) continue;
    marks[i] = 'yellow';
    left.set(guess[i], remaining - 1);
  }

  return marks;
};

const RANK: Record<Mark, number> = { grey: 1, yellow: 2, green: 3 };

/** Best mark seen so far for each letter, for colouring the keyboard. */
export const letterStates = (game: Game): Map<string, Mark> => {
  const states = new Map<string, Mark>();
  for (const guess of game.guesses) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const letter = guess.word[i];
      const mark = guess.marks[i];
      const known = states.get(letter);
      if (!known || RANK[mark] > RANK[known]) states.set(letter, mark);
    }
  }
  return states;
};

export const newGame = (): Game => ({
  answer: ANSWERS[Math.floor(Math.random() * ANSWERS.length)],
  guesses: [],
  current: '',
  status: 'playing',
  message: '',
});

export const typeLetter = (game: Game, letter: string) => {
  if (game.current.length >= WORD_LENGTH) return;
  game.current += letter;
  game.message = '';
};

export const deleteLetter = (game: Game) => {
  game.current = game.current.slice(0, -1);
  game.message = '';
};

export const submitGuess = (game: Game) => {
  const word = game.current;

  if (word.length < WORD_LENGTH) {
    game.message = 'not enough letters';
    return;
  }
  if (!isAccepted(word)) {
    game.message = 'not in word list';
    return;
  }

  game.guesses.push({ word, marks: markGuess(word, game.answer) });
  game.current = '';
  game.message = '';

  if (word === game.answer) game.status = 'won';
  else if (game.guesses.length >= MAX_GUESSES) game.status = 'lost';
};
