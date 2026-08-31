import { run } from './engine/runtime.js';
import type { GameModule } from './engine/types.js';
import { dino } from './games/dino/index.js';
import { solitaire } from './games/solitaire/index.js';
import { sudoku } from './games/sudoku/index.js';
import { wordle } from './games/wordle/index.js';
import pkg from '../package.json';

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

const games: GameModule[] = [sudoku, wordle, solitaire, dino];

run(games);
