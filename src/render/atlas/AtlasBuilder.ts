import { CanvasSource, Rectangle, Texture } from 'pixi.js';

/** Draw callback: paint into `ctx` with (0, 0) at the frame's top-left, in logical pixels. */
export type FramePainter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

interface PendingFrame {
  name: string;
  w: number;
  h: number;
  paint: FramePainter;
}

/** Gap between frames so mipmapping/linear filtering doesn't bleed neighbours. */
const PADDING = 4;
const MAX_ROW_WIDTH = 2048;

/**
 * Collects procedurally painted frames and packs them into a single canvas
 * texture (simple shelf packing). One texture lets Pixi batch all world sprites.
 */
export class AtlasBuilder {
  private readonly frames: PendingFrame[] = [];

  /** Atlas is painted at `resolution`× so tiles stay crisp when zoomed in. */
  constructor(private readonly resolution = 2) {}

  add(name: string, w: number, h: number, paint: FramePainter): this {
    this.frames.push({ name, w, h, paint });
    return this;
  }

  build(): Map<string, Texture> {
    const placed: { f: PendingFrame; x: number; y: number }[] = [];
    let x = PADDING;
    let y = PADDING;
    let rowH = 0;
    let width = 0;
    for (const f of this.frames) {
      if (x + f.w + PADDING > MAX_ROW_WIDTH) {
        x = PADDING;
        y += rowH + PADDING;
        rowH = 0;
      }
      placed.push({ f, x, y });
      x += f.w + PADDING;
      rowH = Math.max(rowH, f.h);
      width = Math.max(width, x);
    }
    const height = y + rowH + PADDING;

    const r = this.resolution;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * r);
    canvas.height = Math.ceil(height * r);
    const ctx = canvas.getContext('2d')!;

    for (const p of placed) {
      ctx.save();
      ctx.setTransform(r, 0, 0, r, p.x * r, p.y * r);
      ctx.beginPath();
      ctx.rect(0, 0, p.f.w, p.f.h);
      ctx.clip();
      p.f.paint(ctx, p.f.w, p.f.h);
      ctx.restore();
    }

    const source = new CanvasSource({
      resource: canvas,
      resolution: r,
      scaleMode: 'linear',
      autoGenerateMipmaps: true,
    });

    const textures = new Map<string, Texture>();
    for (const p of placed) {
      textures.set(p.f.name, new Texture({ source, frame: new Rectangle(p.x, p.y, p.f.w, p.f.h) }));
    }
    return textures;
  }
}
