/**
 * 主循环：固定步长 1/60 累加 + 每帧渲染一次。
 * 逻辑与刷新率解耦，挂机久跑不会因为掉帧而慢下来。
 */
export type LoopHooks = {
  update: (dt: number) => void;
  render: (alpha: number, dt: number) => void;
};

export type LoopOptions = { step?: number; maxSteps?: number; timescale?: number };

export function createLoop(hooks: LoopHooks, options: LoopOptions = {}) {
  const step = options.step ?? 1 / 60;
  const maxSteps = options.maxSteps ?? 5; // 一帧最多补 5 步，防止切回窗口时炸

  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;
  let timescale = options.timescale ?? 1;
  let time = 0;
  let frames = 0;
  let fpsTimer = 0;
  let fps = 0;
  let errors = 0;

  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.5) dt = 0.5; // 挂起过久，别把这段算进去
    dt *= timescale;

    acc += dt;
    let steps = 0;
    while (acc >= step && steps < maxSteps) {
      try {
        hooks.update(step);
      } catch (err) {
        errors++;
        // 单帧异常不带塌整个循环
        if (errors < 50) console.error("[game] update 异常", err);
      }
      acc -= step;
      steps++;
      time += step;
    }
    if (steps === maxSteps) acc = 0;

    try {
      hooks.render(acc / step, dt);
    } catch (err) {
      errors++;
      if (errors < 50) console.error("[game] render 异常", err);
    }

    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fps = frames / fpsTimer;
      frames = 0;
      fpsTimer = 0;
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
    get time() {
      return time;
    },
    get fps() {
      return fps;
    },
    get frameErrors() {
      return errors;
    },
    get timescale() {
      return timescale;
    },
    set timescale(v: number) {
      timescale = Math.max(0, Math.min(8, v));
    },
  };
}

export type GameLoop = ReturnType<typeof createLoop>;
