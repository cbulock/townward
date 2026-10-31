import { ZOOM_MAX, ZOOM_MIN } from '../shared/constants';

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Higher = snappier. Used in a frame-rate independent exponential ease. */
const PAN_SHARPNESS = 14;
const ZOOM_SHARPNESS = 12;

/**
 * Smooth 2D camera over the iso world plane.
 * `x, y` is the world-pixel point at the centre of the screen.
 *
 * Zooming keeps an anchor point (usually the cursor) fixed on screen for the
 * whole eased animation, not just at the end.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1;

  screenW = 1;
  screenH = 1;

  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private bounds: Rect | null = null;

  setScreenSize(w: number, h: number) {
    this.screenW = w;
    this.screenH = h;
  }

  setBounds(bounds: Rect) {
    this.bounds = bounds;
  }

  jumpTo(x: number, y: number, zoom = this.zoom) {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
    this.zoom = this.targetZoom = clampZoom(zoom);
    this.anchor = null;
    this.clamp();
  }

  /** Glide to a world-pixel point (eased by update()). */
  panTo(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
    this.anchor = null;
    this.clamp();
  }

  /** Move immediately by a screen-pixel delta (1:1 drag feel). */
  dragBy(dxScreen: number, dyScreen: number) {
    const dx = -dxScreen / this.zoom;
    const dy = -dyScreen / this.zoom;
    this.x += dx;
    this.y += dy;
    this.targetX += dx;
    this.targetY += dy;
    if (this.anchor) {
      this.anchor.wx += dx;
      this.anchor.wy += dy;
    }
    this.clamp();
  }

  /** Eased move by a screen-pixel delta (keyboard / edge scroll / trackpad). */
  panBy(dxScreen: number, dyScreen: number) {
    const dx = dxScreen / this.targetZoom;
    const dy = dyScreen / this.targetZoom;
    this.targetX += dx;
    this.targetY += dy;
    if (this.anchor) {
      this.anchor.wx += dx;
      this.anchor.wy += dy;
    }
    this.clamp();
  }

  /** Multiply zoom by `factor`, keeping the world point under (sx, sy) fixed. */
  zoomAt(factor: number, sx: number, sy: number) {
    const w = this.screenToWorld(sx, sy);
    this.targetZoom = clampZoom(this.targetZoom * factor);
    this.anchor = { sx, sy, wx: w.x, wy: w.y };
    this.targetX = w.x - (sx - this.screenW / 2) / this.targetZoom;
    this.targetY = w.y - (sy - this.screenH / 2) / this.targetZoom;
    this.clamp();
  }

  update(dt: number) {
    const kz = 1 - Math.exp(-ZOOM_SHARPNESS * dt);
    this.zoom += (this.targetZoom - this.zoom) * kz;

    if (this.anchor) {
      const a = this.anchor;
      this.x = a.wx - (a.sx - this.screenW / 2) / this.zoom;
      this.y = a.wy - (a.sy - this.screenH / 2) / this.zoom;
      if (Math.abs(this.targetZoom - this.zoom) < 1e-4) {
        this.zoom = this.targetZoom;
        this.x = this.targetX;
        this.y = this.targetY;
        this.anchor = null;
      }
    } else {
      const kp = 1 - Math.exp(-PAN_SHARPNESS * dt);
      this.x += (this.targetX - this.x) * kp;
      this.y += (this.targetY - this.y) * kp;
    }
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.screenW / 2) / this.zoom + this.x,
      y: (sy - this.screenH / 2) / this.zoom + this.y,
    };
  }

  /** World-pixel rectangle currently visible on screen. */
  viewRect(): Rect {
    const hw = this.screenW / 2 / this.zoom;
    const hh = this.screenH / 2 / this.zoom;
    return { minX: this.x - hw, minY: this.y - hh, maxX: this.x + hw, maxY: this.y + hh };
  }

  /** Keep the camera centre inside the map so the player can't get lost in the void. */
  private clamp() {
    const b = this.bounds;
    if (!b) return;
    this.targetX = clamp(this.targetX, b.minX, b.maxX);
    this.targetY = clamp(this.targetY, b.minY, b.maxY);
    if (!this.anchor) {
      this.x = clamp(this.x, b.minX, b.maxX);
      this.y = clamp(this.y, b.minY, b.maxY);
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampZoom(z: number) {
  return clamp(z, ZOOM_MIN, ZOOM_MAX);
}
