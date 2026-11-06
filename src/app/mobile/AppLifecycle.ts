export interface LifecycleTarget {
  readonly speed: number;
  readonly muted: boolean;
  setSpeed(speed: number): void;
  setMuted(muted: boolean): void;
  cancelInteraction(): void;
  save(): void;
}

/** Idempotent across overlapping WebView and native visibility notifications. */
export class AppLifecycle {
  private previous: { speed: number; muted: boolean } | null = null;
  private readonly target: LifecycleTarget;

  constructor(target: LifecycleTarget) {
    this.target = target;
  }

  setActive(active: boolean): void {
    if (!active) {
      if (this.previous) return;
      this.previous = { speed: this.target.speed, muted: this.target.muted };
      this.target.cancelInteraction();
      this.target.setSpeed(0);
      this.target.setMuted(true);
      this.target.save();
    } else if (this.previous) {
      const previous = this.previous;
      this.previous = null;
      this.target.setSpeed(previous.speed);
      this.target.setMuted(previous.muted);
    }
  }
}
