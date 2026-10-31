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
 * Page height in logical px. At 2× resolution a page is at most 4096 px on each side,
 * which every WebGL2 device supports. Frames that don't fit start a new page.
 */
const MAX_PAGE_HEIGHT = 2048;

interface Placed {
  f: PendingFrame;
  page: number;
  x: number;
  y: number;
}

/**
 * Collects procedurally painted frames and shelf-packs them into as few canvas
 * textures ("pages") as possible. Sprites sharing a page batch into one draw call.
 */
export class AtlasBuilder {
  private readonly frames: PendingFrame[] = [];

  /** Atlas is painted at `resolution`× so tiles stay crisp when zoomed in. */
  constructor(readonly resolution = 2) {}

  add(name: string, w: number, h: number, paint: FramePainter): this {
    this.frames.push({ name, w, h, paint });
    return this;
  }

  /** Number of pages the last build produced (for the debug overlay). */
  pageCount = 0;

  build(): Map<string, Texture> {
    const placed: Placed[] = [];
    const pageSizes: { w: number; h: number }[] = [];
    let page = 0;
    let x = PADDING;
    let y = PADDING;
    let rowH = 0;
    let width = 0;
    const closePage = () => pageSizes.push({ w: width, h: y + rowH + PADDING });
    for (const f of this.frames) {
      if (x + f.w + PADDING > MAX_ROW_WIDTH) {
        x = PADDING;
        y += rowH + PADDING;
        rowH = 0;
      }
      if (y + f.h + PADDING > MAX_PAGE_HEIGHT) {
        closePage();
        page++;
        x = PADDING;
        y = PADDING;
        rowH = 0;
        width = 0;
      }
      placed.push({ f, page, x, y });
      x += f.w + PADDING;
      rowH = Math.max(rowH, f.h);
      width = Math.max(width, x);
    }
    closePage();
    this.pageCount = pageSizes.length;

    const r = this.resolution;
    const sources = pageSizes.map((size, k) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(size.w * r);
      canvas.height = Math.ceil(size.h * r);
      const ctx = canvas.getContext('2d')!;
      for (const p of placed) {
        if (p.page !== k) continue;
        ctx.save();
        ctx.setTransform(r, 0, 0, r, p.x * r, p.y * r);
        ctx.beginPath();
        ctx.rect(0, 0, p.f.w, p.f.h);
        ctx.clip();
        p.f.paint(ctx, p.f.w, p.f.h);
        ctx.restore();
      }
      return new CanvasSource({ resource: canvas, resolution: r, scaleMode: 'linear', autoGenerateMipmaps: true });
    });

    const textures = new Map<string, Texture>();
    for (const p of placed) {
      textures.set(p.f.name, new Texture({ source: sources[p.page], frame: new Rectangle(p.x, p.y, p.f.w, p.f.h) }));
    }
    return textures;
  }
}
