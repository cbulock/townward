/** Longest frame we simulate; longer gaps (tab in background) are dropped, not caught up. */
const MAX_FRAME_DT = 0.25;

/**
 * Fixed-timestep simulation decoupled from rAF rendering.
 * `tick` runs at `tickHz` (×speed); `frame` runs once per display frame.
 */
export class GameLoop {
  speed = 1;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(
    private readonly tickHz: number,
    private readonly tick: () => void,
    private readonly frame: (dt: number) => void,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const step = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, MAX_FRAME_DT);
      this.last = now;

      if (this.speed > 0) {
        const tickDt = 1 / (this.tickHz * this.speed);
        this.acc += dt;
        while (this.acc >= tickDt) {
          this.tick();
          this.acc -= tickDt;
        }
      }

      this.frame(dt);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resetTime() {
    this.last = performance.now();
    this.acc = 0;
  }
}
