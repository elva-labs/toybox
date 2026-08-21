import { run } from './engine/runtime.js';
import type { GameModule } from './engine/types.js';
import { dino } from './games/dino/index.js';
import { solitaire } from './games/solitaire/index.js';
import { sudoku } from './games/sudoku/index.js';
import { wordle } from './games/wordle/index.js';

const games: GameModule[] = [sudoku, wordle, solitaire, dino];

run(games);
