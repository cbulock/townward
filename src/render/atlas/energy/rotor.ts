import { TONE } from './tones';

/**
 * A wind turbine's rotor: three blades and a hub, drawn the same way for the spinning
 * sprite in the game (render/fx/Rotors.ts) and for still pictures (the picker thumbnail).
 */

/** Blade length in world px. */
export const ROTOR_RADIUS = 30;
/** We see the rotor at an angle, so it is squashed sideways. */
export const ROTOR_SQUASH = 0.55;

/** Where a rotor's hub sits on a building, in view space (like smoke sources). */
export interface RotorSource {
  u: number;
  v: number;
  /** Height above the ground, px. */
  z: number;
  /** Sideways offset of the hub from the tower axis, screen px. */
  dx: number;
}

/** The blades and hub around (0, 0), unsquashed and unturned, at 1 unit = 1 world px. */
export function drawRotor(ctx: CanvasRenderingContext2D) {
  for (let k = 0; k < 3; k++) {
    const a = (k * 2 * Math.PI) / 3 - Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy * 2.4;
    const py = dx * 2.4;
    const tipX = dx * ROTOR_RADIUS;
    const tipY = dy * ROTOR_RADIUS;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tipX + px * 0.2, tipY + py * 0.2);
    ctx.lineTo(tipX - px * 0.2, tipY - py * 0.2);
    ctx.lineTo(-px * 0.6, -py * 0.6);
    ctx.closePath();
    ctx.fillStyle = TONE.turbineBlade;
    ctx.fill();
    ctx.strokeStyle = TONE.turbineEdge;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.fillStyle = TONE.whiteShade;
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/** A still rotor at a screen point, turned by `angle` (thumbnails). */
export function paintRotorStill(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(ROTOR_SQUASH, 1);
  ctx.rotate(angle);
  drawRotor(ctx);
  ctx.restore();
}
