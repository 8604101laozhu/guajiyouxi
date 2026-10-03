/**
 * 音效的护栏测试：没有音频环境必须安全降级、限流、并发上限、静音、峰值自检。
 * 用 ctxFactory 注入假 AudioContext（或返回 null）——不用真设备、不出声也能验规则。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAudio,
  DEFAULT_VOLUME,
  MAX_VOICES,
  SAME_SFX_GAP_MS,
  SFX,
  zzfxBuildSamples,
  type SfxName,
} from "./audio";

const NAMES: SfxName[] = ["pickup", "drop", "unique", "coin"];

/** 假 AudioContext：记下 resume/start/增益，analyser 返回固定峰值 */
function fakeCtx(opts: { state?: string; peak?: number; withAnalyser?: boolean } = {}) {
  const env = { state: opts.state ?? "running" };
  const rec = { resume: 0, start: 0, lengths: [] as number[], rates: [] as number[], gains: [] as { gain: { value: number } }[] };
  const ctx = {
    get state() {
      return env.state;
    },
    destination: {},
    sampleRate: 48000,
    resume() {
      rec.resume++;
      env.state = "running";
      return Promise.resolve();
    },
    createGain() {
      const g = { gain: { value: 1 }, connect() {}, disconnect() {} };
      rec.gains.push(g);
      return g;
    },
    createAnalyser() {
      if (opts.withAnalyser === false) throw new Error("这个环境没有 AnalyserNode");
      return {
        fftSize: 256,
        connect() {},
        getFloatTimeDomainData: (buf: Float32Array) => void buf.fill(opts.peak ?? 0.5),
      };
    },
    createBuffer(_channels: number, len: number, rate: number) {
      rec.lengths.push(len);
      rec.rates.push(rate);
      return { getChannelData: () => new Float32Array(len) };
    },
    createBufferSource() {
      return {
        buffer: null as unknown,
        playbackRate: { value: 1 },
        connect() {},
        start() {
          rec.start++;
        },
      };
    },
  };
  return { ctx: ctx as unknown as AudioContext, rec, env };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("音效：没有音频环境要安全降级", () => {
  it("node/vitest 里默认没有 AudioContext：state=unavailable、play 返回 false、lastPeak 恒 0、不抛", () => {
    const a = createAudio();
    expect(a.state).toBe("unavailable");
    expect(a.play("pickup")).toBe(false);
    expect(a.state).toBe("unavailable");
    expect(a.lastPeak).toBe(0);
    expect(() => a.unlock()).not.toThrow();
    expect(() => a.setMuted(true)).not.toThrow();
  });

  it("ctxFactory 返回 null → unavailable，play 返回 false 而不是抛", () => {
    const a = createAudio({ ctxFactory: () => null });
    expect(a.play("pickup")).toBe(false);
    expect(a.state).toBe("unavailable");
    expect(a.lastPeak).toBe(0);
  });

  it("ctxFactory 自己炸了也不许把主循环带塌", () => {
    const a = createAudio({
      ctxFactory: () => {
        throw new Error("boom");
      },
    });
    expect(a.play("drop")).toBe(false);
    expect(a.state).toBe("unavailable");
  });
});

describe("音效：有音频环境时真的播", () => {
  it("懒创建：第一次 play() 才建 AudioContext，并返回 true；峰值自检 > 0", () => {
    const f = fakeCtx({ peak: 0.5 });
    let made = 0;
    const a = createAudio({
      ctxFactory: () => {
        made++;
        return f.ctx;
      },
    });
    expect(made).toBe(0); // 光 createAudio 不建
    expect(a.play("pickup")).toBe(true);
    expect(made).toBe(1);
    expect(f.rec.start).toBe(1);
    expect(f.rec.rates[0]).toBe(44100);
    expect(a.state).toBe("running");
    expect(a.lastPeak).toBeCloseTo(0.5, 5);
  });

  it("suspended 时 play 会尝试 resume（Electron 没有用户交互时的兜底）", () => {
    const f = fakeCtx({ state: "suspended" });
    const a = createAudio({ ctxFactory: () => f.ctx });
    expect(a.play("unique")).toBe(true);
    expect(f.rec.resume).toBe(1);
    expect(a.state).toBe("running"); // 假 ctx 的 resume 会转成 running
  });

  it("unlock 幂等：连调两次只建一个 ctx、只 resume 一次", () => {
    const f = fakeCtx({ state: "suspended" });
    let made = 0;
    const a = createAudio({
      ctxFactory: () => {
        made++;
        return f.ctx;
      },
    });
    a.unlock();
    a.unlock();
    expect(made).toBe(1);
    expect(f.rec.resume).toBe(1);
    // unlock 会播一个 1 帧的静音 buffer 把音频设备顶起来（冷启动预热），但只顶一次 —— 幂等
    expect(f.rec.start).toBe(1);
    expect(a.state).toBe("running");
  });

  it(`限流：同一音效 ${SAME_SFX_GAP_MS}ms 内第二次返回 false，过了就再能播`, () => {
    vi.useFakeTimers();
    const f = fakeCtx();
    const a = createAudio({ ctxFactory: () => f.ctx });

    expect(a.play("pickup")).toBe(true);
    expect(a.play("pickup")).toBe(false); // 60ms 内不重复
    expect(f.rec.start).toBe(1);

    vi.advanceTimersByTime(SAME_SFX_GAP_MS + 10);
    expect(a.play("pickup")).toBe(true);
    expect(f.rec.start).toBe(2);
  });

  it(`全局并发上限 ${MAX_VOICES}：第 7 个直接挡掉（30 只怪同死不许爆音）`, () => {
    vi.useFakeTimers();
    const f = fakeCtx();
    const a = createAudio({ ctxFactory: () => f.ctx });

    for (const n of NAMES) expect(a.play(n)).toBe(true); // 4 个
    vi.advanceTimersByTime(SAME_SFX_GAP_MS + 10); // 只过了限流窗口，音还没播完
    expect(a.play("pickup")).toBe(true); // 5
    expect(a.play("drop")).toBe(true); // 6
    expect(a.play("unique")).toBe(false); // 7 → 超上限
    expect(a.play("coin")).toBe(false);
    expect(f.rec.start).toBe(MAX_VOICES);
  });

  it("setMuted(true)：state=muted 且 play 立刻 false（连并发名额都不占）；恢复后能播", () => {
    const f = fakeCtx();
    const a = createAudio({ ctxFactory: () => f.ctx });
    expect(a.play("coin")).toBe(true);

    a.setMuted(true);
    expect(a.muted).toBe(true);
    expect(a.state).toBe("muted");
    expect(a.play("pickup")).toBe(false);
    expect(f.rec.start).toBe(1);
    expect(f.rec.gains[0].gain.value).toBe(0); // master 增益归零

    a.setMuted(false);
    expect(a.state).toBe("running");
    expect(f.rec.gains[0].gain.value).toBeCloseTo(DEFAULT_VOLUME, 5);
    expect(a.play("pickup")).toBe(true);
  });

  it(`主音量默认 ${DEFAULT_VOLUME}，且没有 AnalyserNode 时也能播（lastPeak 保持 0）`, () => {
    const f = fakeCtx({ withAnalyser: false });
    const a = createAudio({ ctxFactory: () => f.ctx });
    expect(a.play("drop")).toBe(true);
    expect(f.rec.gains[0].gain.value).toBeCloseTo(DEFAULT_VOLUME, 5);
    expect(a.lastPeak).toBe(0);
  });
});

describe("音效：ZzFX 参数表本身", () => {
  it("四个音效都能合成出非空、有限、有电平的样本", () => {
    for (const name of NAMES) {
      expect(SFX[name].length).toBeGreaterThan(0);
      const s = zzfxBuildSamples(...SFX[name]);
      expect(s.length, `${name} 合成长度为 0`).toBeGreaterThan(0);
      let peak = 0;
      for (let i = 0; i < s.length; i++) {
        expect(Number.isFinite(s[i]), `${name} 第 ${i} 个采样不是有限数`).toBe(true);
        const v = Math.abs(s[i]);
        if (v > peak) peak = v;
      }
      expect(peak, `${name} 是静音`).toBeGreaterThan(0.01);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });
});
