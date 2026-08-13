import {
  BOLD,
  CYAN,
  DIM,
  GREEN,
  GREY,
  RED,
  WHITE,
  YELLOW,
  pad,
  paint,
  width,
} from '../../engine/ansi.js';
import {
  CLOUD,
  DINO_X,
  MESA,
  OFFICE,
  SAUCER,
  FIELD_H,
  FIELD_HH,
  FIELD_W,
  FOREGROUND_SPEED,
  GROUND_HALF,
  type Run,
  STAR_SPEED,
  type Sprite,
  dinoBottomHalf,
  obstacleSubX,
  dinoSprite,
  isNight,
  obstacleSprite,
  subSprite,
} from './state.js';

const INNER = FIELD_W + 2;
/** Two subcolumns per character, matched to the two half rows. */
const FIELD_SW = FIELD_W * 2;

/**
 * Two layers. The subcell canvas holds everything drawn as blocks, at twice the
 * resolution of the character grid in both directions, which is what lets
 * motion land on half a cell. The character layer holds text and specks, and is
 * painted over the collapsed blocks.
 */
interface Canvas {
  ink: string[][];
  /** Subcells belonging to the play field rather than the backdrop. */
  front: boolean[][];
  chars: string[][];
  codes: string[][];
}

const blankCanvas = (): Canvas => ({
  ink: Array.from({ length: FIELD_HH }, () => new Array<string>(FIELD_SW).fill('')),
  front: Array.from({ length: FIELD_HH }, () => new Array<boolean>(FIELD_SW).fill(false)),
  chars: Array.from({ length: FIELD_H }, () => new Array<string>(FIELD_W).fill('')),
  codes: Array.from({ length: FIELD_H }, () => new Array<string>(FIELD_W).fill('')),
});

const stamp = (
  canvas: Canvas,
  sprite: Sprite,
  bottomHalf: number,
  subLeft: number,
  code: string,
  front = false,
) => {
  const wide = subSprite(sprite);
  const top = bottomHalf - wide.length + 1;
  wide.forEach((line, r) => {
    const half = top + r;
    if (half < 0 || half >= FIELD_HH) return;
    for (let c = 0; c < line.length; c++) {
      const sub = subLeft + c;
      if (sub < 0 || sub >= FIELD_SW || line[c] === ' ') continue;
      canvas.ink[half][sub] = code;
      if (front) canvas.front[half][sub] = true;
    }
  });
};

const speck = (canvas: Canvas, row: number, col: number, glyph: string, code: string) => {
  if (row < 0 || row >= FIELD_H || col < 0 || col >= FIELD_W) return;
  if (canvas.chars[row][col]) return;
  canvas.chars[row][col] = glyph;
  canvas.codes[row][col] = code;
};

/** Writes over whatever is behind it, spaces included, so text stays readable. */
const stampText = (canvas: Canvas, row: number, text: string, code: string) => {
  const left = Math.floor((FIELD_W - text.length) / 2);
  for (let c = 0; c < text.length; c++) {
    const col = left + c;
    if (col < 0 || col >= FIELD_W) continue;
    canvas.chars[row][col] = text[c];
    canvas.codes[row][col] = code;
  }
};

/** Stable per column of the scrolling world, so texture travels with the ground. */
const hash = (worldX: number, salt: number) =>
  (Math.imul((worldX + salt) ^ 0x27d4eb2d, 0x165667b1) >>> 0) / 4294967296;

const every = (worldX: number, salt: number, n: number) => Math.floor(hash(worldX, salt) * n) === 0;

/** Text at a chosen column, for signage on the scenery. */
const stampLabel = (canvas: Canvas, row: number, col: number, text: string, code: string) => {
  for (let c = 0; c < text.length; c++) {
    const at = col + c;
    if (at < 0 || at >= FIELD_W || row < 0 || row >= FIELD_H) continue;
    canvas.chars[row][at] = text[c];
    canvas.codes[row][at] = code;
  }
};

const drawProps = (canvas: Canvas, run: Run) => {
  const night = isNight(run);

  for (const prop of run.props) {
    const sub = Math.round(prop.x * 2);
    const half = Math.round(prop.half);

    if (prop.kind === 'mesa') {
      stamp(canvas, MESA, half, sub, DIM);
      continue;
    }
    if (prop.kind === 'saucer') {
      stamp(canvas, SAUCER, half, sub, night ? CYAN : DIM);
      continue;
    }
    if (prop.kind === 'office') stamp(canvas, OFFICE, half, sub, DIM);
  }
};

/**
 * The sign sits on its own building, so it cannot skip every inked cell the way
 * dust does. It skips cells taken by the play field instead, which is what the
 * dino and the obstacles are drawn into.
 */
const drawSignage = (canvas: Canvas, run: Run) => {
  const night = isNight(run);

  for (const prop of run.props) {
    if (prop.kind !== 'office') continue;
    const top = Math.round(prop.half) - OFFICE.length + 1;
    const row = Math.floor((top + 2) / 2);
    const left = Math.round(prop.x) + 5;
    const text = 'ELVA';

    for (let c = 0; c < text.length; c++) {
      const col = left + c;
      if (frontInked(canvas, row, col)) continue;
      stampLabel(canvas, row, col, text[c], night ? YELLOW : DIM);
    }
  }
};

/**
 * The shooting star is a character, and characters paint over blocks, so it is
 * drawn late and skips inked cells. It burns up well above the weather.
 */
const drawShootingStars = (canvas: Canvas, run: Run) => {
  for (const prop of run.props) {
    if (prop.kind !== 'lambda') continue;
    const row = Math.floor(Math.round(prop.half) / 2);
    const col = Math.round(prop.x);
    const trail: [number, number, string, string][] = [
      [row, col, 'λ', `${BOLD}${YELLOW}`],
      [row - 1, col + 1, '·', YELLOW],
      [row - 1, col + 2, '·', DIM],
    ];
    for (const [at, on, glyph, code] of trail) {
      if (inked(canvas, at, on)) continue;
      stampLabel(canvas, at, on, glyph, code);
    }
  }
};

/**
 * Stars live in the character layer, which paints over blocks, so they are
 * drawn after the clouds and scenery and skip anything already inked. A star in
 * front of a cloud would be a star in front of the sky.
 */
const drawStars = (canvas: Canvas, run: Run) => {
  if (!isNight(run)) return;
  const offset = Math.floor(run.distance * STAR_SPEED);
  for (let col = 0; col < FIELD_W; col++) {
    const worldX = col + offset;
    if (!every(worldX, 91, 17)) continue;
    const row = Math.floor(hash(worldX, 7) * 6);
    if (inked(canvas, row, col)) continue;
    speck(canvas, row, col, hash(worldX, 3) < 0.4 ? '+' : '·', DIM);
  }
};

const drawGround = (canvas: Canvas, run: Run) => {
  // Scrolled in subcolumns, so the surface slides by half a character at a time.
  const offset = Math.round(run.distance * 2);
  const ground = isNight(run) ? DIM : GREY;

  for (let sub = 0; sub < FIELD_SW; sub++) {
    const worldX = sub + offset;
    canvas.ink[GROUND_HALF][sub] = ground;
    // The odd stone thickens the line without turning it into a wall.
    if (every(worldX, 23, 19)) canvas.ink[GROUND_HALF + 1][sub] = ground;
  }

  // Foreground grit runs faster than the ground, which reads as depth.
  const near = Math.floor(run.distance * FOREGROUND_SPEED);
  for (let col = 0; col < FIELD_W; col++) {
    const worldX = col + near;
    if (every(worldX, 17, 9)) speck(canvas, FIELD_H - 1, col, '·', DIM);
    else if (every(worldX, 53, 23)) speck(canvas, FIELD_H - 1, col, ',', DIM);
  }
};

/** True when any of the four subcells behind this character already have ink. */
const inked = (canvas: Canvas, row: number, col: number) => {
  const upper = canvas.ink[row * 2];
  const lower = canvas.ink[row * 2 + 1];
  if (!upper || !lower) return false;
  const left = col * 2;
  return Boolean(upper[left] || upper[left + 1] || lower[left] || lower[left + 1]);
};

/** The same, but only counting the play field: the dino, obstacles, ground. */
const frontInked = (canvas: Canvas, row: number, col: number) => {
  const upper = canvas.front[row * 2];
  const lower = canvas.front[row * 2 + 1];
  if (!upper || !lower) return false;
  const left = col * 2;
  return upper[left] || upper[left + 1] || lower[left] || lower[left + 1];
};

const drawParticles = (canvas: Canvas, run: Run) => {
  for (const particle of run.particles) {
    const row = Math.floor(particle.half / 2);
    const col = Math.round(particle.x);
    // Specks live in the character layer, which paints over blocks, so dust
    // must never land on a sprite or it punches holes in it.
    if (inked(canvas, row, col)) continue;
    speck(canvas, row, col, particle.life > 9 ? '∘' : '·', DIM);
  }
};

/** The sixteen quadrant glyphs, indexed by top left, top right, bottom left, bottom right. */
const QUADRANTS = [
  ' ',
  '▗',
  '▖',
  '▄',
  '▝',
  '▐',
  '▞',
  '▟',
  '▘',
  '▚',
  '▌',
  '▙',
  '▀',
  '▜',
  '▛',
  '█',
];

/** Collapses a 2x2 block of subcells into one glyph, merging colour runs. */
const collapse = (canvas: Canvas, row: number) => {
  const upper = canvas.ink[row * 2];
  const lower = canvas.ink[row * 2 + 1];
  const glyphs: string[] = [];
  const codes: string[] = [];

  for (let col = 0; col < FIELD_W; col++) {
    const text = canvas.chars[row][col];
    if (text) {
      glyphs.push(text);
      codes.push(canvas.codes[row][col]);
      continue;
    }
    const left = col * 2;
    const tl = upper[left];
    const tr = upper[left + 1];
    const bl = lower[left];
    const br = lower[left + 1];
    const index = (tl ? 8 : 0) + (tr ? 4 : 0) + (bl ? 2 : 0) + (br ? 1 : 0);
    glyphs.push(QUADRANTS[index]);
    codes.push(tl || tr || bl || br || '');
  }

  let out = '';
  let from = 0;
  for (let col = 1; col <= FIELD_W; col++) {
    if (col === FIELD_W || codes[col] !== codes[from]) {
      const text = glyphs.slice(from, col).join('');
      out += codes[from] ? paint(text, codes[from]) : text;
      from = col;
    }
  }
  return out;
};

const digits = (value: number) => String(Math.min(value, 99999)).padStart(5, '0');

const header = (run: Run, best: number) => {
  const left = `${paint('DINO RUN', BOLD, YELLOW)}  ${paint(isNight(run) ? 'night' : 'day', DIM)}`;
  // The score flashes as it rolls past each hundred, the way the original does.
  const rolling = run.phase === 'running' && run.score % 100 < 6;
  const score = paint(digits(run.score), BOLD, rolling ? YELLOW : WHITE);
  const right = `${paint(`HI ${digits(best)}`, DIM)}  ${score}`;
  return `  ${pad(left, INNER - width(right))}${right}`;
};

const HELP = [
  `${paint('jump', DIM)} space/up   ${paint('duck', DIM)} down   ${paint('restart', DIM)} r   ${paint('back', DIM)} q`,
];

export const renderRun = (run: Run, best: number): string => {
  const canvas = blankCanvas();
  const night = isNight(run);

  drawProps(canvas, run);
  for (const cloud of run.clouds) {
    stamp(canvas, CLOUD, cloud.half, Math.round(cloud.x * 2), night ? DIM : GREY);
  }
  drawGround(canvas, run);

  for (const obstacle of run.obstacles) {
    stamp(
      canvas,
      obstacleSprite(run, obstacle),
      obstacle.bottomHalf,
      obstacleSubX(obstacle),
      obstacle.kind === 'bird' ? CYAN : GREEN,
      true,
    );
  }

  stamp(
    canvas,
    dinoSprite(run),
    dinoBottomHalf(run),
    DINO_X * 2,
    run.phase === 'over' ? RED : WHITE,
    true,
  );
  // Everything in the character layer paints over blocks, so it all goes last
  // and skips inked cells. Otherwise a star sits in front of a cloud, or dust
  // punches a hole in the dino.
  drawSignage(canvas, run);
  drawStars(canvas, run);
  drawShootingStars(canvas, run);
  drawParticles(canvas, run);

  if (run.phase === 'ready') {
    stampText(canvas, 2, 'D I N O   R U N', `${BOLD}${YELLOW}`);
    stampText(canvas, 4, 'space to start', DIM);
  }
  if (run.phase === 'over') {
    stampText(canvas, 2, 'G A M E   O V E R', `${BOLD}${RED}`);
    stampText(canvas, 4, `score ${digits(run.score)}   best ${digits(best)}`, WHITE);
    stampText(canvas, 6, 'space or r to run again', DIM);
  }

  const top = `  ┌${'─'.repeat(FIELD_W)}┐`;
  const bottom = `  └${'─'.repeat(FIELD_W)}┘`;
  const rows: string[] = [];
  for (let row = 0; row < FIELD_H; row++) rows.push(`  │${collapse(canvas, row)}│`);

  return [header(run, best), '', top, ...rows, bottom, '', ...HELP.map((line) => `  ${line}`)].join(
    '\n',
  );
};
