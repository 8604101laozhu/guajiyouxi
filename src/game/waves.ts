/**
 * 刷怪 / 波次：挂机游戏的节拍器。
 * 一波清完 → 歇几秒 → 下一波更多；一波 = d2 关卡表里的一关（怪是什么、多硬由 d2-bridge 决定）。
 * 这里只管「什么时候、刷几个」，不认识 d2，也不知道怪长什么样。
 */

export type WaveState = {
  wave: number;
  kills: number;
  /** 本波还剩几个没刷出来 */
  spawnLeft: number;
  spawnTimer: number;
  /** 波与波之间的休息倒计时 */
  restTimer: number;
  elapsed: number;
};

export const WAVE_RULES = {
  base: 3,
  perWave: 1,
  cap: 12,
  spawnInterval: 0.9,
  rest: 2.5,
} as const;

export function createWaveState(): WaveState {
  return { wave: 0, kills: 0, spawnLeft: 0, spawnTimer: 0, restTimer: 1.2, elapsed: 0 };
}

/** 这一波刷几个：一波 = 一个关卡，数量随关卡数涨，封顶 12 */
export function enemyCountForWave(wave: number): number {
  return Math.min(WAVE_RULES.cap, WAVE_RULES.base + wave * WAVE_RULES.perWave);
}

export type WaveHooks = {
  /** 把敌人放进世界；造什么怪由调用方决定（waves 只管节拍） */
  spawn: (index: number, total: number) => void;
  aliveEnemies: number;
  /** 波次开始时的回调（给 HUD/日志用） */
  onWaveStart?: (wave: number) => void;
};

export function updateWaves(state: WaveState, dt: number, hooks: WaveHooks): void {
  state.elapsed += dt;

  if (state.spawnLeft > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = WAVE_RULES.spawnInterval;
      const total = enemyCountForWave(state.wave);
      const index = total - state.spawnLeft;
      hooks.spawn(index, total);
      state.spawnLeft--;
    }
    return;
  }

  if (hooks.aliveEnemies > 0) return;

  state.restTimer -= dt;
  if (state.restTimer > 0) return;

  state.wave += 1;
  state.spawnLeft = enemyCountForWave(state.wave);
  state.spawnTimer = 0;
  state.restTimer = WAVE_RULES.rest;
  hooks.onWaveStart?.(state.wave);
}

export function noteKill(state: WaveState, n = 1): void {
  state.kills += n;
}
