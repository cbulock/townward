import { Application, Container } from 'pixi.js';
import type { Agent } from '../sim/traffic';
import type { World } from '../sim/World';
import type { TileRect } from './view/ViewTransform';
import { ViewTransform, type Point, type Rotation } from './view/ViewTransform';
import { ViewWorld } from './view/ViewWorld';
import { Camera } from './Camera';
import { ChunkRenderer } from './ChunkRenderer';
import { buildTerrainTextures, type TerrainTextures } from './atlas/tiles';
import { mapWorldBounds, tileToWorld, worldToTileFloat } from './iso';
import { HoverHighlight } from './overlays/HoverHighlight';
import { ToolPreview } from './overlays/ToolPreview';
import { Effects } from './fx/Effects';
import { AgentRenderer } from './agents/AgentRenderer';
import { Indicators } from './overlays/Indicators';

/** Mutable handle to the current view rotation, shared with overlays, effects and agents. */
export interface ViewRef {
  current: ViewTransform;
}

/** Seconds for the fade-in after a rotation. */
const ROTATE_FADE = 0.28;

/**
 * Owns the Pixi application and the world scene graph:
 *   stage
 *   └─ worldRoot (camera transform)
 *      ├─ terrain  (slab, dual-grid ground masked to the map, roads, grid; rebuilt on rotation)
 *      ├─ agents   (cars, pedestrians; under objects so buildings in front cover them)
 *      ├─ objects  (trees, decorations, buildings)
 *      ├─ fx       (build pops, particles)
 *      └─ overlay  (tool ghosts, hover, warning badges)
 *
 * Everything below worldRoot is drawn in *view* space (the map after the current
 * number of quarter turns). Callers pass world tile coordinates; this class and
 * the overlays convert through `viewRef`. See docs/decisions.md D-032.
 */
export class Renderer {
  readonly app: Application;
  readonly camera = new Camera();
  readonly worldRoot = new Container();
  private readonly terrain = new Container();
  readonly objects = new Container();
  readonly overlay = new Container();
  readonly viewRef: ViewRef;
  readonly toolPreview: ToolPreview;
  ground!: ChunkRenderer;
  hover!: HoverHighlight;
  textures!: TerrainTextures;
  effects!: Effects;
  agents!: AgentRenderer;
  indicators!: Indicators;
  private viewWorld!: ViewWorld;
  private agentSource: () => readonly Agent[] = () => [];
  private rotateFade = 0;
  /** Boot timings (ms) for the debug overlay. */
  readonly timings = { atlas: 0, chunks: 0 };

  /** Draw calls issued during the last rendered frame (WebGL only). */
  drawCalls = 0;
  private drawCallCounter = 0;

  private constructor(
    app: Application,
    private readonly world: World,
  ) {
    this.app = app;
    this.viewRef = { current: new ViewTransform(world.width, world.height, 0) };
    this.toolPreview = new ToolPreview(this.viewRef);
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
    const r = new Renderer(app, world);
    r.setup();
    host.appendChild(app.canvas);
    return r;
  }

  get view(): ViewTransform {
    return this.viewRef.current;
  }

  /** Where the agent layer reads cars and people from each frame. */
  setAgentSource(source: () => readonly Agent[]) {
    this.agentSource = source;
  }

  private setup() {
    let t0 = performance.now();
    const tex = buildTerrainTextures();
    this.timings.atlas = performance.now() - t0;
    this.textures = tex;
    this.effects = new Effects(tex.fx, this.viewRef);
    this.agents = new AgentRenderer(tex, this.viewRef);
    this.indicators = new Indicators(tex.warnRoad, this.viewRef);
    this.hover = new HoverHighlight(tex.hover, this.viewRef);
    t0 = performance.now();
    this.buildTerrain();
    this.timings.chunks = performance.now() - t0;
    this.overlay.addChild(this.toolPreview.container, this.hover.sprite, this.indicators.container);

    this.worldRoot.addChild(this.terrain, this.agents.container, this.objects, this.effects.container, this.overlay);
    this.app.stage.addChild(this.worldRoot);

    this.camera.setScreenSize(this.app.screen.width, this.app.screen.height);
    const b = mapWorldBounds(this.view.viewW, this.view.viewH);
    this.camera.jumpTo((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 1);

    this.instrumentDrawCalls();
  }

  /** (Re)build the view-space copy of the world and its chunked terrain for the current rotation. */
  private buildTerrain() {
    const grid = this.ground?.gridOn ?? false;
    if (this.ground) this.ground.destroy();
    this.viewWorld = new ViewWorld(this.view, this.world.seed);
    this.viewWorld.sync(this.world);
    this.ground = new ChunkRenderer(this.viewWorld, this.textures);
    this.terrain.addChild(this.ground.slab, this.ground.groundMask, this.ground.groundRoot, this.ground.roadsRoot, this.ground.gridRoot);
    this.objects.addChild(this.ground.objectsRoot);
    this.ground.setGrid(grid);
    this.camera.setBounds(mapWorldBounds(this.view.viewW, this.view.viewH));
  }

  get rotation(): Rotation {
    return this.view.r;
  }

  /** Turn the view, keeping the world point at the centre of the screen where it is. */
  setRotation(r: Rotation) {
    if (r === this.view.r) return;
    const cam = this.camera;
    const before = worldToTileFloat(cam.x, cam.y);
    const centre = this.view.pointToWorld(before.x, before.y);
    this.viewRef.current = new ViewTransform(this.world.width, this.world.height, r);
    this.buildTerrain();
    const after = this.view.pointToView(centre.x, centre.y);
    const p = tileToWorld(after.x, after.y);
    cam.jumpTo(p.x, p.y, cam.zoom);
    this.indicators.sync(this.world);
    this.rotateFade = ROTATE_FADE;
  }

  /** World changed inside `rect` (world tiles): re-sync the view copy and rebuild touched chunks. */
  refreshWorld(rect: TileRect) {
    this.viewWorld.sync(this.world);
    const r = this.view.rectToView(rect);
    this.ground.refresh(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
  }

  /** World tile under a screen point (CSS px), clamped to the map. */
  screenToTile(sx: number, sy: number, clamp: boolean): Point | null {
    const w = this.camera.screenToWorld(sx, sy);
    const t = worldToTileFloat(w.x, w.y);
    const vx = Math.floor(t.x);
    const vy = Math.floor(t.y);
    const v = this.view;
    if (!clamp && (vx < 0 || vy < 0 || vx >= v.viewW || vy >= v.viewH)) return null;
    const cx = Math.min(v.viewW - 1, Math.max(0, vx));
    const cy = Math.min(v.viewH - 1, Math.max(0, vy));
    return v.tileToWorld(cx, cy);
  }

  /** Wrap the GL draw functions so the debug overlay can show draw calls per frame. */
  private instrumentDrawCalls() {
    const gl = (this.app.renderer as { gl?: WebGL2RenderingContext }).gl;
    if (!gl) return;
    const names = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const;
    for (const name of names) {
      const original = gl[name] as (...args: unknown[]) => void;
      if (typeof original !== 'function') continue;
      // Safe: we replace a method with a wrapper of the same arity that forwards all args.
      // The GL context type has no index signature, so a double cast is needed to assign by name.
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
    if (this.rotateFade > 0) {
      this.rotateFade = Math.max(0, this.rotateFade - dt);
      const t = 1 - this.rotateFade / ROTATE_FADE;
      this.worldRoot.alpha = 0.35 + 0.65 * t * (2 - t);
    } else if (this.worldRoot.alpha !== 1) this.worldRoot.alpha = 1;

    const viewRect = cam.viewRect();
    this.ground.cull(viewRect);
    this.agents.update(this.world, this.agentSource(), viewRect, cam.zoom);
    this.ground.update(dt);
    this.hover.update(dt);
    this.toolPreview.update(dt);
    this.effects.update(dt);
    this.indicators.update(dt);

    this.drawCallCounter = 0;
    this.app.render();
    this.drawCalls = this.drawCallCounter;
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }
}
