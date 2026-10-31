/**
 * Procedural sound effects (Web Audio): no audio files, like the art.
 * The AudioContext is created on the first user gesture (browsers block audio before that).
 */
export type SoundId = 'build' | 'bridge' | 'clear' | 'error' | 'tool' | 'tick';

const MUTE_KEY = 'citybuilder.muted';
const MASTER_VOLUME = 0.6;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage unavailable (private mode etc): mute just won't persist.
  }
}

export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private mutedState = readMuted();
  private readonly cleanup: () => void;

  constructor() {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.cleanup = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }

  get muted(): boolean {
    return this.mutedState;
  }

  setMuted(muted: boolean) {
    this.mutedState = muted;
    writeMuted(muted);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
  }

  private unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.mutedState ? 0 : MASTER_VOLUME;
      master.connect(ctx.destination);
      const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noise = noise;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Play a sound `delay` seconds from now; `pitch` scales its frequencies (1 = normal). */
  play(id: SoundId, delay = 0, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.mutedState) return;
    const t = ctx.currentTime + delay;
    switch (id) {
      case 'tick':
        this.tone('sine', 1100 * pitch, 750 * pitch, t, 0.045, 0.06);
        break;
      case 'tool':
        this.tone('sine', 880, 990, t, 0.035, 0.05);
        break;
      case 'build':
        this.tone('sine', 150 * pitch, 55 * pitch, t, 0.16, 0.32);
        this.burst(t, 0.07, 900, 'bandpass', 0.14);
        break;
      case 'bridge':
        this.tone('sine', 120, 50, t, 0.2, 0.3);
        this.tone('triangle', 660, 650, t + 0.02, 0.45, 0.06);
        this.tone('triangle', 990, 980, t + 0.05, 0.35, 0.03);
        break;
      case 'clear':
        this.burst(t, 0.28, 1800, 'lowpass', 0.3, 350);
        for (let k = 0; k < 4; k++) this.burst(t + 0.03 + k * 0.045, 0.02, 2500, 'bandpass', 0.12);
        break;
      case 'error':
        this.tone('square', 130, 120, t, 0.09, 0.05);
        this.tone('square', 98, 92, t + 0.11, 0.12, 0.05);
        break;
    }
  }

  /** Oscillator sweeping from f0 to f1 with a fast attack and exponential decay. */
  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered noise burst; optional sweep of the filter down to `sweepTo`. */
  private burst(t: number, dur: number, freq: number, type: BiquadFilterType, gain: number, sweepTo?: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.2);
    src.stop(t + dur + 0.02);
  }

  destroy() {
    this.cleanup();
    void this.ctx?.close();
  }
}
