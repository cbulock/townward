/** Small white particle sprites; they're tinted at runtime. */

export const PUFF_SIZE = 16;
export const CHIP_SIZE = 6;
export const LEAF_SIZE = 8;

/** Soft round dust puff. */
export function paintPuff(ctx: CanvasRenderingContext2D) {
  const r = PUFF_SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.55, 'rgba(255, 255, 255, 0.55)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PUFF_SIZE, PUFF_SIZE);
}

/** Chunky pixel chip (rock grit, wood splinter). */
export function paintChip(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(1, 1, CHIP_SIZE - 2, CHIP_SIZE - 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(1, CHIP_SIZE - 2, CHIP_SIZE - 2, 1);
}

/** Tiny leaf: a pointed oval with a darker midrib. */
export function paintLeaf(ctx: CanvasRenderingContext2D) {
  const c = LEAF_SIZE / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(1, c);
  ctx.quadraticCurveTo(c, 0, LEAF_SIZE - 1, c);
  ctx.quadraticCurveTo(c, LEAF_SIZE, 1, c);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(2, c - 0.5, LEAF_SIZE - 4, 1);
}
