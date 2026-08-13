/**
 * Play field in character cells. Fixed size, it never scales to the terminal.
 * Vertically everything works in half rows, since the renderer draws with half
 * block glyphs and gets two rows of resolution out of every character cell.
 */
export const FIELD_W = 68;
export const FIELD_H = 14;
export const FIELD_HH = FIELD_H * 2;

/** Surface of the ground, and the half row a standing sprite rests on. */
export const GROUND_HALF = 24;
export const BASE_HALF = GROUND_HALF - 1;
export const DINO_X = 4;
/** Bottom half row of a bird that has to be ducked under. */
export const BIRD_HIGH_HALF = 15;

/**
 * Pacing is written per second so the tick rate is free to change without
 * altering how the game feels. Rows and columns are field units.
 */
export const TICK_MS = 20;
const PER_TICK = TICK_MS / 1000;

export const GRAVITY = 48 * PER_TICK * PER_TICK;
/**
 * Sized so the slowest speed is still clearable. Counterintuitively low speed
 * is the hard case: the obstacle crawls past while the dino is coming down.
 */
export const JUMP_VELOCITY = 24 * PER_TICK;
/** Ticks a full jump spends off the ground. Obstacle spacing is built from this. */
export const AIR_TICKS = Math.ceil((2 * JUMP_VELOCITY) / GRAVITY);
export const DUCK_TICKS = Math.round(1000 / TICK_MS);
export const BASE_SPEED = 21 * PER_TICK;
export const MAX_SPEED = 44 * PER_TICK;
export const SPEED_RAMP = 0.0115 * PER_TICK;
export const BIRD_SCORE = 150;

/**
 * Difficulty is not just speed. Spacing tightens and birds get more common as
 * the score climbs, so the run keeps getting harder after speed has capped.
 */
export const GAP_PAD_START = 12;
export const GAP_PAD_MIN = 5;
export const GAP_RANGE_START = 26;
export const GAP_RANGE_MIN = 6;

export const padFor = (score: number) => Math.max(GAP_PAD_MIN, GAP_PAD_START - score / 250);
export const rangeFor = (score: number) => Math.max(GAP_RANGE_MIN, GAP_RANGE_START - score / 120);
export const birdChanceFor = (score: number) => Math.min(0.5, 0.2 + score / 6000);
/** Score interval between day and night. */
export const NIGHT_EVERY = 700;

/** Animation periods in ticks. The run cycle also scales with speed. */
export const WING_TICKS = Math.round(120 / TICK_MS);
export const SLOW_LEG_TICKS = Math.round(140 / TICK_MS);
export const FAST_LEG_TICKS = Math.round(70 / TICK_MS);

/** Parallax factors. Above 1 is nearer than the ground. */
export const CLOUD_SPEED = 0.3;
export const STAR_SPEED = 0.05;
export const FOREGROUND_SPEED = 1.45;
export const CLOUD_GAP = 40;

/**
 * A sprite is a bitmap of half rows, top down. '#' is ink and a space is
 * transparent, so what collides is exactly what gets drawn.
 */
export type Sprite = string[];

/**
 * Sprites are sized against the jump arc, not just for looks. A wider dino
 * takes longer to pass an obstacle than one jump can stay airborne, and a
 * taller obstacle needs more height, so both are capped. They are also solid
 * silhouettes on purpose: half block collapse turns any one half row gap into
 * a ▀ or ▄ notch, so internal detail like an eye reads as damage.
 */
const RUN_FRAMES: Sprite[] = [
  ['    ###', '    ###', '   ####', '   ### ', '#  ### ', '## ####', '#######', ' ######', ' ##  ##', ' #    #'],
  ['    ###', '    ###', '   ####', '   ### ', '#  ### ', '## ####', '#######', ' ######', '  ####', '  #  #'],
];

const JUMP_FRAME: Sprite = [
  '    ###',
  '    ###',
  '   ####',
  '   ### ',
  '#  ### ',
  '## ####',
  '#######',
  ' ######',
  ' ##### ',
  '   ##  ',
];

const DEAD_FRAME: Sprite = [
  '    ###',
  '    ###',
  '   ####',
  '   ### ',
  '#  ### ',
  '## ####',
  '#######',
  ' ######',
  '#     #',
  '#     #',
];

const DUCK_FRAMES: Sprite[] = [
  ['      ###', '      ###', '#########', '#########', ' ##   ## ', ' #     # '],
  ['      ###', '      ###', '#########', '#########', '  ## ##  ', '  #   #  '],
];

const CACTI: Sprite[] = [
  [' # ', ' # ', '## ', '## ', '###', '###', ' # ', ' # '],
  [' # ', ' # ', ' ##', ' ##', '###', '###', ' # ', ' # '],
  [' # ', '## ', '## ', '###', '###', ' # ', ' # ', ' # '],
  ['#  #', '#  #', '#  #', '####', '####', ' ## ', ' ## ', ' ## '],
];

const BIRD_FRAMES: Sprite[] = [
  [' ##   ', '###   ', '######', '  ##  ', '   #  ', '      '],
  ['      ', '      ', '######', '###   ', ' ##   ', '  #   '],
];

export const CLOUD: Sprite = ['  ####  ', ' ###### ', '########'];

/** Scenery that drifts past in the background. None of it collides. */
export const MESA: Sprite = [
  '    ######  ',
  '   ######## ',
  '  ##########',
  '  ##########',
  ' ###########',
  '############',
  '############',
  '############',
];

export const OFFICE: Sprite = [
  '   ########   ',
  '  ##########  ',
  ' ############ ',
  ' # ## ## ## # ',
  ' ############ ',
  ' # ## ## ## # ',
  ' ############ ',
  ' # ## ## ## # ',
  ' ############ ',
  ' ############ ',
  ' ####    #### ',
  ' ####    #### ',
];

export const SAUCER: Sprite = [
  '   ###   ',
  '  #####  ',
  ' ####### ',
  '#########',
  ' ## # ## ',
  '  #   #  ',
];

export type PropKind = 'mesa' | 'office' | 'saucer' | 'lambda';

export interface Prop {
  kind: PropKind;
  x: number;
  half: number;
  /** Below 1 is further away and drifts slower. */
  parallax: number;
  /** Only the shooting star moves under its own steam. */
  fall: number;
  life: number;
}

/** How often scenery turns up, in columns travelled. Bigger is rarer. */
export const PROP_GAP = 700;

export type Phase = 'ready' | 'running' | 'over';

export interface Obstacle {
  kind: 'cactus' | 'bird';
  /** Left column. Fractional while it scrolls, rounded when drawn and tested. */
  x: number;
  width: number;
  frames: Sprite[];
  /** Half row the last sprite line sits on. */
  bottomHalf: number;
}

export interface Cloud {
  x: number;
  half: number;
}

/** Dust kicked up on takeoff and landing. Cosmetic only. */
export interface Particle {
  x: number;
  half: number;
  drift: number;
  life: number;
}

export interface Run {
  phase: Phase;
  /** Columns travelled. */
  distance: number;
  score: number;
  speed: number;
  /** Rows above BASE_HALF, in whole rows. Rendered at half row precision. */
  dinoY: number;
  velocity: number;
  airborne: boolean;
  duckTicks: number;
  ticks: number;
  obstacles: Obstacle[];
  clouds: Cloud[];
  particles: Particle[];
  props: Prop[];
  /** Columns left before the next obstacle enters. */
  spawnIn: number;
  cloudIn: number;
  propIn: number;
  seed: number;
}

/**
 * Sprites are authored one character per column, but everything is drawn and
 * tested at two subcolumns per column so motion can land on half a character.
 * Widening each column to two subcolumns keeps the art unchanged.
 */
const widened = new Map<Sprite, Sprite>();

export const subSprite = (sprite: Sprite): Sprite => {
  const known = widened.get(sprite);
  if (known) return known;
  const wide = sprite.map((line) =>
    [...line].map((glyph) => (glyph === ' ' ? '  ' : '##')).join(''),
  );
  widened.set(sprite, wide);
  return wide;
};

const nextRandom = (run: Run) => {
  run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
  return run.seed / 4294967296;
};

const spriteWidth = (sprite: Sprite) => Math.max(...sprite.map((line) => line.length));

/**
 * The smallest gap a player can still clear at this speed. The default pad is
 * the floor the spawner is allowed to tighten to, so this doubles as the
 * invariant every generated gap has to satisfy.
 */
export const minClearGap = (speed: number, pad = GAP_PAD_MIN) =>
  Math.ceil(AIR_TICKS * speed) + pad;

export const speedFor = (score: number) => Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_RAMP);

export const isNight = (run: Run) => Math.floor(run.score / NIGHT_EVERY) % 2 === 1;

export const createRun = (seed = Date.now()): Run => ({
  phase: 'ready',
  distance: 0,
  score: 0,
  speed: BASE_SPEED,
  dinoY: 0,
  velocity: 0,
  airborne: false,
  duckTicks: 0,
  ticks: 0,
  obstacles: [],
  clouds: [{ x: 46, half: 5 }],
  particles: [],
  props: [],
  spawnIn: 34,
  cloudIn: CLOUD_GAP,
  propIn: PROP_GAP,
  seed: seed >>> 0,
});

const spawnObstacle = (run: Run) => {
  const flying = run.score >= BIRD_SCORE && nextRandom(run) < birdChanceFor(run.score);
  const obstacle: Obstacle = flying
    ? {
        kind: 'bird',
        x: FIELD_W,
        width: spriteWidth(BIRD_FRAMES[0]),
        frames: BIRD_FRAMES,
        bottomHalf: nextRandom(run) < 0.55 ? BIRD_HIGH_HALF : BASE_HALF,
      }
    : (() => {
        const shape = CACTI[Math.floor(nextRandom(run) * CACTI.length)];
        return {
          kind: 'cactus' as const,
          x: FIELD_W,
          width: spriteWidth(shape),
          frames: [shape],
          bottomHalf: BASE_HALF,
        };
      })();

  run.obstacles.push(obstacle);
  // Measured from this obstacle's right edge, so the next one is always clearable.
  run.spawnIn =
    minClearGap(run.speed, padFor(run.score)) +
    obstacle.width +
    Math.floor(nextRandom(run) * rangeFor(run.score));
};

const spawnCloud = (run: Run) => {
  run.clouds.push({ x: FIELD_W, half: 2 + Math.floor(nextRandom(run) * 8) });
  run.cloudIn = CLOUD_GAP + Math.floor(nextRandom(run) * 50);
};

/**
 * Scenery, weighted so the mesa is ordinary and the rest are treats. The saucer
 * and the shooting star only turn out after dark.
 */
const spawnProp = (run: Run) => {
  const roll = nextRandom(run);
  const night = isNight(run);
  let kind: PropKind = 'mesa';

  if (night && roll > 0.9) kind = 'lambda';
  else if (night && roll > 0.8) kind = 'saucer';
  else if (roll > 0.66) kind = 'office';

  if (kind === 'lambda') {
    run.props.push({
      kind,
      x: FIELD_W * (0.55 + nextRandom(run) * 0.4),
      half: 1 + nextRandom(run) * 3,
      parallax: 3.2,
      fall: 0.34,
      life: 999,
    });
  } else if (kind === 'saucer') {
    run.props.push({ kind, x: FIELD_W, half: 4 + nextRandom(run) * 4, parallax: 0.45, fall: 0, life: 999 });
  } else if (kind === 'office') {
    run.props.push({ kind, x: FIELD_W, half: GROUND_HALF - 1, parallax: 0.55, fall: 0, life: 999 });
  } else {
    run.props.push({ kind, x: FIELD_W, half: GROUND_HALF - 1, parallax: 0.28, fall: 0, life: 999 });
  }

  run.propIn = PROP_GAP * (0.6 + nextRandom(run) * 1.2);
};

const spawnDust = (run: Run, count: number, spread: number) => {
  for (let i = 0; i < count; i++) {
    run.particles.push({
      // Behind the feet, so it reads as kicked up rather than sprayed ahead.
      x: DINO_X - 1 + nextRandom(run) * 3,
      half: BASE_HALF - nextRandom(run) * 2,
      drift: 0.4 + nextRandom(run) * spread,
      life: 8 + Math.floor(nextRandom(run) * 10),
    });
  }
};

/** Legs cycle faster the quicker the ground moves. */
const legTicks = (run: Run) => {
  const range = MAX_SPEED - BASE_SPEED;
  const t = range > 0 ? Math.min(1, Math.max(0, (run.speed - BASE_SPEED) / range)) : 0;
  return Math.max(1, Math.round(SLOW_LEG_TICKS + (FAST_LEG_TICKS - SLOW_LEG_TICKS) * t));
};

export const dinoSprite = (run: Run): Sprite => {
  if (run.phase === 'over') return DEAD_FRAME;
  if (run.airborne) return JUMP_FRAME;
  const frame = Math.floor(run.ticks / legTicks(run)) % 2;
  return run.duckTicks > 0 ? DUCK_FRAMES[frame] : RUN_FRAMES[frame];
};

export const obstacleSprite = (run: Run, obstacle: Obstacle): Sprite =>
  obstacle.frames[Math.floor(run.ticks / WING_TICKS) % obstacle.frames.length];

/** Half row the dino's feet rest on, rounded to the renderer's resolution. */
export const dinoBottomHalf = (run: Run) => BASE_HALF - Math.round(run.dinoY * 2);

/** Subcolumn the obstacle is drawn at, which is also what it collides at. */
export const obstacleSubX = (obstacle: Obstacle) => Math.round(obstacle.x * 2);

const cellsOf = (sprite: Sprite, bottomHalf: number, subLeft: number): number[][] => {
  const cells: number[][] = [];
  const top = bottomHalf - sprite.length + 1;
  sprite.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== ' ') cells.push([top + r, subLeft + c]);
    }
  });
  return cells;
};

/** Subcell against subcell, so what you see is exactly what collides. */
export const collides = (run: Run): boolean => {
  const sprite = subSprite(dinoSprite(run));
  const dinoSub = DINO_X * 2;
  const dino = cellsOf(sprite, dinoBottomHalf(run), dinoSub);
  const reach = dinoSub + spriteWidth(sprite);
  for (const obstacle of run.obstacles) {
    const left = obstacleSubX(obstacle);
    if (left > reach || left + obstacle.width * 2 < dinoSub) continue;
    const shape = subSprite(obstacleSprite(run, obstacle));
    const top = obstacle.bottomHalf - shape.length + 1;
    for (const [half, sub] of dino) {
      const line = shape[half - top];
      if (line === undefined) continue;
      const glyph = line[sub - left];
      if (glyph !== undefined && glyph !== ' ') return true;
    }
  }
  return false;
};

export const startRun = (run: Run) => {
  if (run.phase === 'ready') run.phase = 'running';
};

export const jump = (run: Run) => {
  if (run.phase !== 'running' || run.airborne) return;
  run.airborne = true;
  run.velocity = JUMP_VELOCITY;
  run.duckTicks = 0;
  spawnDust(run, 4, 0.8);
};

export const duck = (run: Run) => {
  if (run.phase !== 'running') return;
  run.duckTicks = DUCK_TICKS;
};

const moveParticles = (run: Run) => {
  for (const particle of run.particles) {
    particle.x -= run.speed * particle.drift;
    particle.half -= 0.06;
    particle.life--;
  }
  run.particles = run.particles.filter((particle) => particle.life > 0 && particle.x > 0);
};

export const tick = (run: Run) => {
  run.ticks++;
  if (run.phase !== 'running') {
    moveParticles(run);
    return;
  }

  run.speed = speedFor(run.score);
  run.distance += run.speed;
  run.score = Math.floor(run.distance);

  if (run.airborne) {
    run.dinoY += run.velocity;
    run.velocity -= GRAVITY;
    if (run.dinoY <= 0) {
      run.dinoY = 0;
      run.velocity = 0;
      run.airborne = false;
      spawnDust(run, 6, 1.1);
    }
  }
  if (run.duckTicks > 0) run.duckTicks--;

  for (const obstacle of run.obstacles) obstacle.x -= run.speed;
  run.obstacles = run.obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);
  run.spawnIn -= run.speed;
  if (run.spawnIn <= 0) spawnObstacle(run);

  for (const cloud of run.clouds) cloud.x -= run.speed * CLOUD_SPEED;
  run.clouds = run.clouds.filter((cloud) => cloud.x + CLOUD[0].length > 0);
  run.cloudIn -= run.speed;
  if (run.cloudIn <= 0) spawnCloud(run);

  for (const prop of run.props) {
    prop.x -= run.speed * prop.parallax;
    prop.half += prop.fall;
  }
  run.props = run.props.filter((prop) => prop.x > -OFFICE[0].length && prop.half < GROUND_HALF);
  run.propIn -= run.speed;
  if (run.propIn <= 0) spawnProp(run);

  moveParticles(run);

  if (collides(run)) {
    run.phase = 'over';
    spawnDust(run, 8, 1.4);
  }
};
