/**
 * Per-system time spent in the simulation (docs/specs/engine.md, "Timings"). The F3 overlay
 * and the headless harness (`pnpm sim:run`) read it. Two clock reads per call: cheap enough
 * to stay on all the time.
 */

export interface SystemTiming {
  /** `system.hook`, e.g. `commute.day`. */
  readonly name: string;
  readonly calls: number;
  readonly totalMs: number;
  readonly avgMs: number;
  readonly maxMs: number;
}

interface Entry {
  calls: number;
  totalMs: number;
  maxMs: number;
}

export class SystemTimings {
  private readonly entries = new Map<string, Entry>();

  /** Run `fn`, adding its time to `name`. */
  run<T>(name: string, fn: () => T): T {
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      const ms = performance.now() - t0;
      const e = this.entries.get(name);
      if (e) {
        e.calls++;
        e.totalMs += ms;
        if (ms > e.maxMs) e.maxMs = ms;
      } else {
        this.entries.set(name, { calls: 1, totalMs: ms, maxMs: ms });
      }
    }
  }

  /** Slowest total first. */
  snapshot(): SystemTiming[] {
    return [...this.entries]
      .map(([name, e]) => ({ name, calls: e.calls, totalMs: e.totalMs, avgMs: e.totalMs / e.calls, maxMs: e.maxMs }))
      .sort((a, b) => b.totalMs - a.totalMs);
  }

  reset() {
    this.entries.clear();
  }
}
