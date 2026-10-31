import { Application, Container } from 'pixi.js';
import type { World } from '../sim/World';
import { Camera } from './Camera';
import { ChunkRenderer } from './ChunkRenderer';
import { buildTileTextures } from './atlas/tiles';
import { mapWorldBounds } from './iso';
import { HoverHighlight } from './overlays/HoverHighlight';

/**
 * Owns the Pixi application and the world scene graph:
 *   stage
 *   └─ worldRoot (camera transform)
 *      ├─ ground   (chunked tiles)
 *      ├─ objects  (trees/buildings, later phases)
 *      └─ overlay  (hover, ghosts, zone tint)
 */
export class Renderer {
  readonly app: Application;
  readonly camera = new Camera();
  readonly worldRoot = new Container();
  readonly objects = new Container();
  readonly overlay = new Container();
  ground!: ChunkRenderer;
  hover!: HoverHighlight;

  /** Draw calls issued during the last rendered frame (WebGL only). */
  drawCalls = 0;
  private drawCallCounter = 0;

  private constructor(app: Application) {
    this.app = app;
  }

  static async create(host: HTMLElement, world: World): Promise<Renderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      preference: 'webgl',
      background: '#0d1117',
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoStart: false,
      powerPreference: 'high-performance',
    });
    const r = new Renderer(app);
    r.setup(world);
    host.appendChild(app.canvas);
    return r;
  }

  private setup(world: World) {
    const tex = buildTileTextures();
    this.ground = new ChunkRenderer(world, tex);
    this.hover = new HoverHighlight(tex.hover);
    this.overlay.addChild(this.hover.sprite);

    this.worldRoot.addChild(this.ground.root, this.objects, this.overlay);
    this.app.stage.addChild(this.worldRoot);

    const b = mapWorldBounds(world.width, world.height);
    this.camera.setBounds(b);
    this.camera.setScreenSize(this.app.screen.width, this.app.screen.height);
    this.camera.jumpTo((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 1);

    this.instrumentDrawCalls();
  }

  /** Wrap the GL draw functions so the debug overlay can show draw calls per frame. */
  private instrumentDrawCalls() {
    const gl = (this.app.renderer as { gl?: WebGL2RenderingContext }).gl;
    if (!gl) return;
    const names = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const;
    for (const name of names) {
      const original = gl[name] as (...args: unknown[]) => void;
      if (typeof original !== 'function') continue;
      (gl as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
        this.drawCallCounter++;
        original.apply(gl, args);
      };
    }
  }

  render(dt: number) {
    const cam = this.camera;
    cam.setScreenSize(this.app.screen.width, this.app.screen.height);
    cam.update(dt);

    this.worldRoot.scale.set(cam.zoom);
    this.worldRoot.position.set(cam.screenW / 2 - cam.x * cam.zoom, cam.screenH / 2 - cam.y * cam.zoom);

    this.ground.cull(cam.viewRect());
    this.hover.update(dt);

    this.drawCallCounter = 0;
    this.app.render();
    this.drawCalls = this.drawCallCounter;
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }
}
