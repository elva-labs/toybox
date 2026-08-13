import { KEY, isEnter } from '../../engine/input.js';
import type { GameContext, GameInstance, GameModule } from '../../engine/types.js';
import { renderRun } from './render.js';
import { TICK_MS, createRun, duck, jump, startRun, tick } from './state.js';

interface Saved {
  best: number;
}

const start = (ctx: GameContext): GameInstance => {
  let run = createRun();
  let best = ctx.store.read<Saved>({ best: 0 }).best;

  const restart = () => {
    run = createRun();
    startRun(run);
  };

  return {
    tickMs: TICK_MS,
    onTick: () => {
      tick(run);
      if (run.phase === 'over' && run.score > best) {
        best = run.score;
        ctx.store.write({ best } satisfies Saved);
      }
    },
    render: () => renderRun(run, best),
    onKey: (key) => {
      if (key === 'q' || key === KEY.escape) {
        ctx.exit();
        return;
      }

      const jumpKey = key === KEY.space || key === KEY.up || isEnter(key);

      if (run.phase === 'ready') {
        if (jumpKey) startRun(run);
        return;
      }
      if (run.phase === 'over') {
        if (jumpKey || key === 'r') restart();
        return;
      }

      if (jumpKey) jump(run);
      else if (key === KEY.down) duck(run);
      else if (key === 'r') restart();
    },
  };
};

export const dino: GameModule = {
  id: 'dino',
  title: 'Dino Run',
  blurb: 'jump the cacti, endless runner',
  start,
};
