/**
 * 音效（拾取 / 落地 / 暗金 / 金币）。
 *
 * 这个文件只负责：合成、限流、静音、峰值自检 —— 不认识游戏，也不认识 d2。
 * 它是**唯一碰 Web Audio 的文件**：别的模块只调 play(name)，拿不到音频环境也不该知道细节。
 *
 * 合成本身是 **ZzFX micro by Frank Force (KilledByAPixel)** 的忠实转写，MIT 许可：
 *   https://github.com/KilledByAPixel/ZzFX （v1.4.0 / ZzFXMicro.js）
 * 只做了一处结构性改动：官方 micro 在模块顶层 `new AudioContext`（node/vitest 里一 import 就炸），
 * 这里改成**懒创建 + 可注入 ctxFactory**，并在外面挂 master 增益与 AnalyserNode。
 *
 * 降级铁律：没有音频环境（node / vitest / 被策略挡住）不许 throw，play() 返回 false。
 */
export type SfxName = "pickup" | "drop" | "unique" | "coin";

/** ZzFX 合成采样率（与官方 micro 一致；createBuffer 会自己重采样到设备采样率） */
export const SAMPLE_RATE = 44100;
/** 主音量默认值（0.35） */
export const DEFAULT_VOLUME = 0.35;
/** 同一音效的最小间隔（毫秒）：30 只怪同死时不许叠成爆音 */
export const SAME_SFX_GAP_MS = 60;
/** 全局同时最多几个音 */
export const MAX_VOICES = 6;
/** AnalyserNode 的 fftSize：只要时域峰值，够小就够快 */
export const ANALYSER_FFT = 256;
/** 峰值采样间隔（毫秒，约一帧）：pickup 这类音效只有几十毫秒，
 *  固定采两次（60/140ms）会整个漏掉——所以要在声音存续期间连续采 */
export const PEAK_SAMPLE_MS = 16;
/** 声音结束后再多采一小段，别把尾巴切掉 */
export const PEAK_TAIL_MS = 60;
/** 冷启动时「预热设备」和「放真正第一声」之间要隔多久（毫秒）：
 *  同一 tick 里 start() 会被音频设备初始化吃掉 —— 真机实测第一声峰值恒为 0 */
export const WARMUP_DELAY_MS = 80;

/**
 * 每个音效一行 ZzFX 参数，顺序与官方一致（后面的可以省略，省略即用默认值）：
 *   volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
 *   slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
 *   bitCrush, delay, sustainVolume, decay, tremolo, filter
 * shape: 0 正弦 / 1 三角 / 2 锯齿 / 3 tan / 4 噪声 / 5 占空比方波
 */
export const SFX: Record<SfxName, number[]> = {
  /** 拾取：短促上扬的三角波「叮」 */
  pickup: [0.7, 0.02, 560, 0, 0.02, 0.09, 1, 1.4, 0, 0, 300, 0.04],
  /** 掉落落地：闷一点的 tan 波「咚」，带一点噪声 */
  drop: [0.5, 0.06, 180, 0, 0.04, 0.14, 3, 1, -60, -20],
  /** 暗金：两段上跳的小号角（repeatTime 让它「吹」两下） */
  unique: [0.8, 0.01, 420, 0.01, 0.1, 0.22, 0, 1, 0, 0, 520, 0.06, 0.09],
  /** 金币：经典两音「叮叮」 */
  coin: [0.6, 0.01, 988, 0, 0.05, 0.12, 1, 1, 0, 0, 0, 0, 0.07],
};

export type AudioHandle = {
  /** 返回 true 表示真的播出去了（静音/限流/没有音频环境时返回 false） */
  play(name: SfxName, opts?: { volume?: number; detune?: number }): boolean;
  /** "running" | "suspended" | "unavailable" | "muted" */
  readonly state: string;
  readonly muted: boolean;
  setMuted(m: boolean): void;
  /** 首次用户交互时调用；浏览器/Electron 策略允许时解锁 AudioContext（幂等） */
  unlock(): void;
  /** 自检用：最近一次播放的时域峰值（0~1）；拿不到音频环境时恒为 0 */
  readonly lastPeak: number;
};

/**
 * ZzFX micro 的合成核心（官方 buildSamples 的转写，参数顺序/换算/波形分支一一对应）。
 * 参数是数组是因为音效表写成「一行参数」，多余的参数省略即可。
 */
export function zzfxBuildSamples(...p: number[]): Float32Array {
  const [
    volume = 1,
    randomness = 0.05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = 0.1,
    shape = 0,
    shapeCurve = 1,
    slide = 0,
    deltaSlide = 0,
    pitchJump = 0,
    pitchJumpTime = 0,
    repeatTime = 0,
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0,
    filter = 0,
  ] = p;

  const PI2 = Math.PI * 2;
  const sign = (v: number) => (v < 0 ? -1 : 1);

  // 时间参数从「秒」换算成「采样点数」（官方原样：0 攻击最少给 9 个采样点，否则开头爆音）
  const attackN = attack * SAMPLE_RATE || 9;
  const decayN = decay * SAMPLE_RATE;
  const sustainN = sustain * SAMPLE_RATE;
  const releaseN = release * SAMPLE_RATE;
  const delayN = delay * SAMPLE_RATE;
  const repeatN = (repeatTime * SAMPLE_RATE) | 0;
  const pitchJumpSamples = pitchJumpTime * SAMPLE_RATE;
  const length = (attackN + decayN + sustainN + releaseN + delayN) | 0;
  const out = new Float32Array(Math.max(0, length));

  // biquad 低通/高通（quality 固定 2，与官方一致）
  const w = (PI2 * Math.abs(filter) * 2) / SAMPLE_RATE;
  const cosW = Math.cos(w);
  const alpha = Math.sin(w) / 4;
  const a0 = 1 + alpha;
  const a1 = (-2 * cosW) / a0;
  const a2 = (1 - alpha) / a0;
  const fb0 = (1 + (sign(filter) * cosW)) / 2 / a0;
  const fb1 = -(sign(filter) + cosW) / a0;
  const fb2 = fb0;
  const delayVolume = volume || 1;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  // 频率参数：slide / deltaSlide 是「每采样点的增量」，随采样率平方（三次方）缩放
  let slideN = (slide * 500 * PI2) / SAMPLE_RATE / SAMPLE_RATE;
  const slideStart = slideN;
  let freq = frequency * (1 + randomness * 2 * Math.random() - randomness) * (PI2 / SAMPLE_RATE);
  let freqStart = freq;
  const deltaSlideN = (deltaSlide * 500 * PI2) / SAMPLE_RATE ** 3;
  const modulationN = (modulation * PI2) / SAMPLE_RATE;
  const pitchJumpN = (pitchJump * PI2) / SAMPLE_RATE;

  let t = 0; // 相位
  let s = 0; // 当前样本
  let f = 0; // 当前步进的角频率（含调制），用来推进相位
  let modOffset = 0;
  let repeatCount = 0;
  let crushCount = 0;
  let jumpCount = 1; // 音高跳变计时器（0 = 已经跳过）

  for (let i = 0; i < length; i++) {
    // 位压缩：每 (bitCrush*100) 个采样点才算一次波形（其余样本保持），bitCrush=0 时取模为 NaN → 每次都算
    if (!(++crushCount % ((bitCrush * 100) | 0))) {
      // 波形：占空比方波 / 噪声 / tan / 锯齿 / 三角 / 正弦
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? shape > 4
                ? ((t / PI2) % 1 < shapeCurve / 2 ? 1 : -1)
                : Math.sin(t ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - ((((2 * t) / PI2) % 2) + 2) % 2
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      // 包络（攻击 → 衰减 → 保持 → 释放）× 颤音 × 波形曲线
      s =
        (repeatN ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatN) : 1) *
        (shape > 4 ? s : sign(s) * Math.abs(s) ** shapeCurve) *
        (i < attackN
          ? i / attackN
          : i < attackN + decayN
            ? 1 - ((i - attackN) / decayN) * (1 - sustainVolume)
            : i < attackN + decayN + sustainN
              ? sustainVolume
              : i < length - delayN
                ? ((length - i - delayN) / releaseN) * sustainVolume
                : 0);
      // 回声：把 delay 之前的样本叠一半回来
      if (delayN) {
        s =
          s / 2 +
          (delayN > i
            ? 0
            : (i < length - delayN ? 1 : (length - i) / delayN) * (out[(i - delayN) | 0] / 2 / delayVolume));
      }
      // 滤波：官方写法 s = y1 = b2*x2 + b1*(x2=x1) + b0*(x1=s) - a2*y2 - a1*(y2=y1)
      if (filter) {
        const filtered = fb2 * x2 + fb1 * (x2 = x1) + fb0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
        y1 = filtered;
        s = filtered;
      }
    }

    out[i] = s * volume;

    // 推进频率与相位（官方：frequency += slide += deltaSlide，然后过调制）
    f = (freq += slideN += deltaSlideN) * Math.cos(modulationN * modOffset++);
    t += f + f * noise * (((i * i * PI2) % 2) - 1);

    if (jumpCount && ++jumpCount > pitchJumpSamples) {
      freq += pitchJumpN;
      freqStart += pitchJumpN;
      jumpCount = 0;
    }
    if (repeatN && !(++repeatCount % repeatN)) {
      freq = freqStart;
      slideN = slideStart;
      jumpCount = jumpCount || 1;
    }
  }

  return out;
}

/** 默认取 context 的构造器（浏览器 / Electron 渲染进程） */
function defaultContext(): AudioContext | null {
  const g = globalThis as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (typeof Ctor !== "function") return null;
  return new Ctor();
}

/** 没有 ctxFactory 时，先看环境里到底有没有 AudioContext（只读，不创建） */
function hasAudioContext(): boolean {
  const g = globalThis as { AudioContext?: unknown; webkitAudioContext?: unknown };
  return typeof g.AudioContext === "function" || typeof g.webkitAudioContext === "function";
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

type AudioEnv = {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode | null;
  /** 显式写 <ArrayBuffer>：TS 5.7+ 的 getFloatTimeDomainData 只收 ArrayBuffer 背后的 Float32Array */
  peakBuf: Float32Array<ArrayBuffer> | null;
};

/** ctxFactory 只为测试注入假 AudioContext；默认内部懒创建 */
export function createAudio(opts: { ctxFactory?: () => AudioContext | null; volume?: number } = {}): AudioHandle {
  const volume = clamp01(opts.volume ?? DEFAULT_VOLUME);
  const factory = opts.ctxFactory ?? defaultContext;
  let env: AudioEnv | null = null;
  let failed = false; // 试过一次拿不到就永远降级，别每次 play 都去撞墙
  let muted = false;
  let lastPeak = 0;
  /** 冷启动预热只做一次（见 warmUp） */
  let warmed = false;
  /** 峰值采样的定时器（每次 play 都重排，旧的要清掉） */
  const peakTimers: ReturnType<typeof setTimeout>[] = [];
  const lastAt: Record<SfxName, number> = { pickup: -Infinity, drop: -Infinity, unique: -Infinity, coin: -Infinity };
  /** 每个活跃音的预计结束时刻（毫秒）：用时间戳算并发，不依赖 onended（假 ctx / 真 ctx 都一致） */
  const voices: number[] = [];
  /** 时间口径用 Date.now()：单测能用假定时器推进（不依赖 performance.now 是否被 mock） */
  const now = () => Date.now();

  function ensure(): AudioEnv | null {
    if (env) return env;
    if (failed) return null;
    let ctx: AudioContext | null = null;
    try {
      ctx = factory();
    } catch {
      ctx = null;
    }
    if (!ctx) {
      failed = true;
      return null;
    }
    try {
      const master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      let analyser: AnalyserNode | null = null;
      let peakBuf: Float32Array<ArrayBuffer> | null = null;
      try {
        analyser = ctx.createAnalyser();
        analyser.fftSize = ANALYSER_FFT;
        peakBuf = new Float32Array(analyser.fftSize || ANALYSER_FFT);
        master.connect(analyser);
        analyser.connect(ctx.destination);
      } catch {
        // 没有 AnalyserNode 也能出声，只是 lastPeak 恒为 0
        analyser = null;
        peakBuf = null;
        master.connect(ctx.destination);
      }
      env = { ctx, master, analyser, peakBuf };
      return env;
    } catch {
      failed = true;
      return null;
    }
  }

  function stopPeakTimers(): void {
    for (const t of peakTimers) {
      try {
        clearInterval(t as unknown as number);
        clearTimeout(t as unknown as number);
      } catch {
        /* 清不掉就算了 */
      }
    }
    peakTimers.length = 0;
  }

  function resume(e: AudioEnv): void {
    try {
      void Promise.resolve(e.ctx.resume()).catch(() => {});
    } catch {
      /* resume 失败就当它还是 suspended，下一次 play 再试 */
    }
  }

  /**
   * 冷启动「预热」：音频设备从 resume 到真正出声要几十~150ms，这段时间里的第一声会被吃掉
   * （真机实测：第一次 play 峰值恒为 0，之后 drop/unique/coin 的 0.28~0.39 都正常）。
   * 先播一个 1 帧的静音 buffer 把设备顶起来，正式音效就不会被吞。
   */
  function warmUp(e: AudioEnv): void {
    if (warmed) return; // 只预热一次：反反复复顶设备没意义，还会破坏 unlock 的幂等语义
    warmed = true;
    try {
      const buf = e.ctx.createBuffer(1, 1, SAMPLE_RATE);
      const src = e.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(e.master);
      src.start();
    } catch {
      /* 预热失败不影响后续播放 */
    }
  }

  /** 读一次时域峰值（真机自检靠它证明「真的出声」） */
  function samplePeak(): void {
    const analyser = env?.analyser;
    const buf = env?.peakBuf;
    if (!analyser || !buf || !buf.length) return;
    try {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
      }
      lastPeak = Math.max(lastPeak, clamp01(peak)); // 取本次播放窗口内的最大值
    } catch {
      /* 采样失败不影响播放 */
    }
  }

  function schedulePeak(durationMs: number): void {
    if (typeof setInterval !== "function" || typeof clearInterval !== "function") return;
    stopPeakTimers();
    // 声音存续期间连续采（16ms 一次），结束后再补一小段尾巴
    const until = now() + durationMs + PEAK_TAIL_MS;
    const timer = setInterval(() => {
      samplePeak();
      if (now() >= until) stopPeakTimers();
    }, PEAK_SAMPLE_MS);
    peakTimers.push(timer);
  }

  function play(name: SfxName, o?: { volume?: number; detune?: number }): boolean {
    if (muted) return false;
    const t = now();
    // 同一音效 60ms 内不重复（限流在「真的播出去」之前判，失败不占用额度）
    if (t - lastAt[name] < SAME_SFX_GAP_MS) return false;
    const params = SFX[name];
    if (!params) return false;
    const e = ensure();
    if (!e) return false;
    /** 冷启动兜底：suspended 时立刻 start() 会被音频设备初始化吃掉，得等 resume 完再 start */
    const needsResume = e.ctx.state === "suspended";

    // 全局并发：先把已经播完的丢掉
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i] <= t) voices.splice(i, 1);
    if (voices.length >= MAX_VOICES) return false;

    let samples: Float32Array;
    try {
      samples = zzfxBuildSamples(...params);
    } catch {
      return false;
    }
    if (!samples.length) return false;

    try {
      const buffer = e.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
      const src = e.ctx.createBufferSource();
      src.buffer = buffer;
      if (o?.detune) src.playbackRate.value = 2 ** (o.detune / 1200); // detune 单位是音分
      if (o?.volume === undefined) {
        src.connect(e.master);
      } else {
        const gain = e.ctx.createGain();
        gain.gain.value = Math.max(0, o.volume);
        src.connect(gain);
        gain.connect(e.master);
      }
      const begin = () => {
        try {
          src.start();
        } catch {
          /* 起不来就算了，主循环不许被带塌 */
        }
      };
      if (needsResume) {
        void Promise.resolve(e.ctx.resume()).then(
          () => {
            // 冷启动：先顶一下设备，隔一小会儿再放真正的音 —— 同一 tick 抢设备会把这一声吃掉
            warmUp(e);
            setTimeout(begin, WARMUP_DELAY_MS);
          },
          () => begin(),
        );
      } else begin();
    } catch {
      return false;
    }

    lastAt[name] = t;
    const durationMs = (samples.length / SAMPLE_RATE) * 1000;
    voices.push(t + durationMs);
    lastPeak = 0; // 每次播放重新计时：静音的那次不许沿用上一次的峰值（自检要诚实）
    samplePeak();
    schedulePeak(durationMs); // 渲染线程还没把样本送进来，得在声音存续期间连续采
    return true;
  }

  return {
    play,
    get state(): string {
      if (muted) return "muted";
      if (failed) return "unavailable";
      if (env) return env.ctx.state;
      // 还没建过：只探环境，不创建（读一下状态不该有副作用，懒创建留给 play/unlock）
      const canProbe = opts.ctxFactory ? true : hasAudioContext();
      return canProbe ? "suspended" : "unavailable";
    },
    get muted() {
      return muted;
    },
    setMuted(m: boolean): void {
      muted = m;
      if (!env) return;
      try {
        env.master.gain.value = muted ? 0 : volume;
      } catch {
        /* 增益设不上不影响其它 */
      }
    },
    unlock(): void {
      const e = ensure();
      if (!e) return;
      if (e.ctx.state === "suspended") {
        // 必须等 resume 落地再预热：resume 是异步的，立刻 start() 会被设备初始化吃掉
        void Promise.resolve(e.ctx.resume()).then(
          () => warmUp(e),
          () => warmUp(e),
        );
      } else {
        warmUp(e);
      }
    },
    get lastPeak() {
      return lastPeak;
    },
  };
}
