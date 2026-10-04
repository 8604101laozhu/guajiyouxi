/**
 * 舞台调度：英雄站哪儿、怪从哪儿进场。
 *
 * 挂机条是**固定舞台**：英雄钉在画面偏中间的位置不再推图，怪从**画面右侧**走进来，
 * 于是交战点永远在画面中间附近（不再像推图那样一路往右漂）。
 *
 * 为什么怪要「赶路速度」：d2 那边给的移动速度是远程 30 / 近战 52~70 px/s，
 * 从 2560 宽的右边缘走到中间 1400px 要 20~46 秒 —— 挂机屏上看着就是「干等」。
 * 所以远处用进场速度（倍率 + 下限），进入交战距离再回到自己的速度。
 */

/** 英雄站在画面的这个比例处（略偏左：右边留给走进来的怪） */
export const HERO_SCREEN_FRAC = 0.45;
/** 怪从右边缘往里这么多像素进场（留在画面内，肉眼能看见它「走进来」） */
export const ENEMY_SPAWN_MARGIN = 36;
/** 同一波怪的横向错开，别叠在一起进场 */
export const ENEMY_SPAWN_SPREAD = 70;
/** 多于这个距离算「赶路」，用进场速度 */
export const TRAVEL_DISTANCE = 300;
/** 赶路时的速度倍率 */
export const TRAVEL_MULT = 4.5;
/** 进场速度的下限（远程怪本体只有 30 px/s，光乘倍率还是太慢） */
export const MIN_TRAVEL_SPEED = 200;

/** 英雄的站位（世界坐标）：把画面比例换算过去，换窗口宽度也钉在同一屏幕位置 */
export function heroPostX(camX: number, viewW: number): number {
  return camX + viewW * HERO_SCREEN_FRAC;
}

/**
 * 怪的进场点（世界坐标）：画面右边缘往里 ENEMY_SPAWN_MARGIN，同一波再错开一点。
 * 夹在场景范围内，别跑到世界外面去。
 */
export function enemySpawnX(opts: { camX: number; viewW: number; boundsW: number; index: number }): number {
  const { camX, viewW, boundsW, index } = opts;
  const fromRight = camX + viewW - ENEMY_SPAWN_MARGIN - (index % 4) * ENEMY_SPAWN_SPREAD;
  return Math.min(boundsW - 24, Math.max(80, fromRight));
}

/** 这一帧该用哪个速度：远处赶路用进场速度，近了用自己的速度 */
export function travelSpeed(base: number, dist: number): number {
  if (dist <= TRAVEL_DISTANCE) return base;
  return Math.max(base * TRAVEL_MULT, MIN_TRAVEL_SPEED);
}
