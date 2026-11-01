/**
 * Art for the things render/ambient animates: lit windows, mast beacons, fountain spray, birds
 * and drifting cloud shadows. Small frames painted once into the main atlas, so they batch with
 * the buildings they sit on.
 */

/** Window glow frames: a parallelogram sheared like a SW or SE wall, soft at the edges. */
export const GLOW_W = 12;
export const GLOW_H = 18;
/** Fraction of the frame height the shear takes (a window w px wide drops w/2 px across). */
export const GLOW_SHEAR = GLOW_W / 2;

export function paintWindowGlow(ctx: CanvasRenderingContext2D, face: 'sw' | 'se') {
  const s = face === 'sw' ? 1 : -1;
  const top = face === 'sw' ? 0 : GLOW_SHEAR;
  const h = GLOW_H - GLOW_SHEAR;
  const quad = (inset: number) => {
    ctx.beginPath();
    ctx.moveTo(inset, top + inset);
    ctx.lineTo(GLOW_W - inset, top + (s * (GLOW_W - 2 * inset)) / 2 + inset);
    ctx.lineTo(GLOW_W - inset, top + (s * (GLOW_W - 2 * inset)) / 2 + h - inset);
    ctx.lineTo(inset, top + h - inset);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  quad(0);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  quad(1.2);
  ctx.fill();
}

export const BEACON_SIZE = 12;

/** Round red-white glow for a mast beacon (tinted at runtime). */
export function paintBeacon(ctx: CanvasRenderingContext2D) {
  const r = BEACON_SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.18, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.4, 'rgba(255, 255, 255, 0.35)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BEACON_SIZE, BEACON_SIZE);
}

export const DROP_SIZE = 4;

/** A water droplet: bright core, soft rim. */
export function paintDroplet(ctx: CanvasRenderingContext2D) {
  const r = DROP_SIZE / 2;
  const g = ctx.createRadialGradient(r - 0.4, r - 0.4, 0, r, r, r);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.5, 'rgba(214, 240, 255, 0.85)');
  g.addColorStop(1, 'rgba(160, 210, 245, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DROP_SIZE, DROP_SIZE);
}

export const BIRD_W = 10;
export const BIRD_H = 6;

/** A small bird seen from above and behind, wings up (frame 0) or down (frame 1). */
export function paintBird(ctx: CanvasRenderingContext2D, frame: 0 | 1) {
  const cx = BIRD_W / 2;
  const cy = BIRD_H / 2;
  ctx.strokeStyle = '#2b3038';
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const tip = frame === 0 ? -2.4 : 1.6;
  ctx.moveTo(cx - 4.4, cy + tip * 0.6);
  ctx.quadraticCurveTo(cx - 2.2, cy + tip, cx, cy + 0.6);
  ctx.quadraticCurveTo(cx + 2.2, cy + tip, cx + 4.4, cy + tip * 0.6);
  ctx.stroke();
  ctx.fillStyle = '#2b3038';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.7, 0.9, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export const CLOUD_W = 160;
export const CLOUD_H = 80;

/** A soft cloud shadow: a cluster of feathered blobs, white (tinted dark and faint at runtime). */
export function paintCloudShadow(ctx: CanvasRenderingContext2D) {
  const blobs: readonly (readonly [number, number, number])[] = [
    [52, 42, 30],
    [84, 36, 34],
    [114, 44, 28],
    [72, 52, 26],
    [100, 54, 24],
  ];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    g.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.55);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
