import { Application, Container, Sprite, Texture } from 'pixi.js';
import type { Agent, BusStop, TrafficLight } from '../sim/systems/traffic';
import { QuadBatch, tintColor } from './ground/TileMesh';
import { tileQuadPoints } from './view/lift';
import type { World } from '../sim/World';
import type { TileRect } from './view/ViewTransform';
import { ViewTransform, type Point, type Rotation } from './view/ViewTransform';
import { ViewWorld } from './view/ViewWorld';
import { Camera } from './Camera';
import { BorderRenderer } from './BorderRenderer';
import { borderRing, generateBorderlands } from '../sim/terrain/borderlands';
import { releaseTileShaders } from './ground/TileMesh';
import { HEIGHT_STEP, TILE_W } from '../shared/constants';
import { surfaceHeight } from '../sim/terrain/elevation';
import { ChunkRenderer } from './ChunkRenderer';
import { buildTerrainTextures, type TerrainTextures } from './atlas/tiles';
import { mapWorldBounds, tileToWorld, worldToTileFloat } from './iso';
import { HoverHighlight } from './overlays/HoverHighlight';
import { ToolPreview } from './overlays/ToolPreview';
import { Effects } from './fx/Effects';
import { AgentRenderer } from './agents/AgentRenderer';
import { Indicators } from './overlays/Indicators';

/** Mutable handle to the current view, shared with overlays, effects and agents. */
export interface ViewRef {
  current: ViewTransform;
  /** The world re-laid out in view space (heights for lifting things onto the terrain). */
  ground: World;
}

/** Congestion colour: green, yellow, orange, red (docs/specs/traffic.md). */
export function congestionColor(c: number): number {
  return c < 0.6 ? 0x4ade80 : c < 1 ? 0xfacc15 : c < 1.5 ? 0xfb923c : 0xef4444;
}

/** Opacity of buildings and trees while the traffic overlay is on. */
const TRAFFIC_VIEW_FADE = 0.25;

/** Seconds for the fade-in after a rotation. */
const ROTATE_FADE = 0.28;
/** Zone layer strength outside the zone view (zone tools show it at full strength). */
const ZONE_ALPHA = 0.45;

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
  /** Borderlands: decorative land round the map (render-only), regenerated if the map edge changes. */
  private ext!: World;
  private readonly ring: number;
  border!: BorderRenderer;
  private agentSource: () => readonly Agent[] = () => [];
  private stopSource: () => readonly BusStop[] = () => [];
  private lightSource: () => readonly TrafficLight[] = () => [];
  /** Traffic overlay: road tiles tinted by congestion (null = off). */
  private readonly trafficLayer = new Container();
  private trafficLevels: Float32Array | null = null;
  private rotateFade = 0;
  /** Multiply layer for the day/night tint, over the world but under tool overlays. */
  private readonly daylight = new Sprite(Texture.WHITE);
  private zoneView = false;
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
    this.viewRef = { current: new ViewTransform(world.width, world.height, 0), ground: world };
    this.ring = borderRing(world.width);
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

  /** Where the agent layer reads cars, people and bus stops from each frame. */
  setAgentSource(source: () => readonly Agent[], stops: () => readonly BusStop[], lights: () => readonly TrafficLight[]) {
    this.agentSource = source;
    this.stopSource = stops;
    this.lightSource = lights;
  }

  /**
   * Show road congestion (per world tile, volume ÷ capacity) as coloured road tiles, or hide
   * it with null. Call again whenever the numbers change; rotation redraws it automatically.
   */
  setTrafficOverlay(congestion: Float32Array | null) {
    this.trafficLevels = congestion;
    this.trafficLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    // Buildings and trees fade so the coloured roads between them can be seen.
    this.objects.alpha = congestion ? TRAFFIC_VIEW_FADE : 1;
    if (!congestion) return;
    const w = this.world;
    const batch = new QuadBatch();
    for (let i = 0; i < w.road.length; i++) {
      if (w.road[i] === 0 || w.bridge[i] !== 0) continue;
      const x = i % w.width;
      const y = (i - x) / w.width;
      const v = this.view.tileToView(x, y);
      const color = tintColor(congestionColor(congestion[i]), 1);
      batch.add({ texture: this.textures.selection, points: tileQuadPoints(this.viewWorld, v.x, v.y), colors: [color, color, color, color, color], grow: 0 });
    }
    if (!batch.empty) this.trafficLayer.addChild(batch.build());
  }

  private setup() {
    let t0 = performance.now();
    const tex = buildTerrainTextures();
    this.timings.atlas = performance.now() - t0;
    this.textures = tex;
    this.effects = new Effects(tex.fx, this.viewRef);
    this.agents = new AgentRenderer(tex, this.viewRef);
    this.indicators = new Indicators({ road: tex.warnRoad, power: tex.warnPower, water: tex.warnWater }, this.viewRef);
    this.hover = new HoverHighlight(tex.hover, this.viewRef);
    t0 = performance.now();
    this.ext = generateBorderlands(this.world, this.ring);
    this.buildTerrain();
    this.timings.chunks = performance.now() - t0;
    this.overlay.addChild(this.toolPreview.container, this.hover.container, this.indicators.container);

    this.daylight.blendMode = 'multiply';
    this.daylight.visible = false;
    this.worldRoot.addChild(this.terrain, this.agents.container, this.objects, this.effects.container, this.daylight, this.overlay);
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
    this.border?.destroy();
    this.viewWorld = new ViewWorld(this.view, this.world.seed);
    this.viewWorld.sync(this.world);
    this.viewRef.ground = this.viewWorld;
    this.ground = new ChunkRenderer(this.viewWorld, this.textures);
    this.border = new BorderRenderer(this.ext, this.ring, this.viewWorld, this.view.r, this.textures);
    this.terrain.addChild(
      this.border.ground,
      this.ground.groundMask,
      this.ground.groundRoot,
      this.border.line,
      this.ground.zonesRoot,
      this.ground.roadsRoot,
      this.ground.gridRoot,
      this.trafficLayer,
    );
    if (this.trafficLevels) this.setTrafficOverlay(this.trafficLevels);
    this.ground.zonesRoot.alpha = this.zoneView ? 1 : ZONE_ALPHA;
    // Ring trees behind the map draw before its objects, the ones in front after.
    this.objects.addChild(this.border.backObjects, this.ground.objectsRoot, this.border.frontObjects);
    this.ground.setGrid(grid);
    // Allow panning a quarter of the way into the borderlands.
    const b = mapWorldBounds(this.view.viewW, this.view.viewH);
    this.camera.setFitWidth(b.maxX - b.minX);
    const m = this.ring * 0.25 * TILE_W;
    this.camera.setBounds({ minX: b.minX - m, maxX: b.maxX + m, minY: b.minY - m / 2, maxY: b.maxY + m / 2 });
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

  /** World changed inside these rects (world tiles): re-sync the view copy once and rebuild touched chunks. */
  refreshWorld(...rects: TileRect[]) {
    if (rects.length === 0) return;
    this.viewWorld.sync(this.world);
    this.ground.refresh(
      rects.map((rect) => {
        const r = this.view.rectToView(rect);
        return { minX: r.x, minY: r.y, maxX: r.x + r.w - 1, maxY: r.y + r.h - 1 };
      }),
    );
  }

  /** Day/night colour (0xffffff = plain daylight, which hides the layer). */
  setDaylight(color: number) {
    this.daylight.tint = color;
    this.daylight.visible = color !== 0xffffff;
  }

  /** Corners of the screen as continuous *view* tile coordinates (for the minimap). */
  viewportTiles(): Point[] {
    const cam = this.camera;
    return [
      [0, 0],
      [cam.screenW, 0],
      [cam.screenW, cam.screenH],
      [0, cam.screenH],
    ].map(([sx, sy]) => {
      const w = cam.screenToWorld(sx, sy);
      return worldToTileFloat(w.x, w.y);
    });
  }

  /** Glide the camera to a continuous view-tile point. */
  panToViewTile(p: Point) {
    const w = tileToWorld(p.x, p.y);
    this.camera.panTo(w.x, w.y);
  }

  /** Show zones at full strength (while a zone tool is active). */
  setZoneView(on: boolean) {
    this.zoneView = on;
    this.ground.zonesRoot.alpha = on ? 1 : ZONE_ALPHA;
  }

  /**
   * World tile under a screen point (CSS px), clamped to the map. On sloped ground this
   * iterates: guess a height, project to a tile point at that height, read the surface
   * there, repeat. It converges because slopes rise less than HALF_H per tile.
   */
  screenToTile(sx: number, sy: number, clamp: boolean): Point | null {
    const w = this.camera.screenToWorld(sx, sy);
    let t = worldToTileFloat(w.x, w.y);
    let h = 0;
    for (let k = 0; k < 8; k++) {
      t = worldToTileFloat(w.x, w.y + h * HEIGHT_STEP);
      const next = surfaceHeight(this.viewWorld, t.x, t.y);
      if (Math.abs(next - h) < 0.01) break;
      h = next;
    }
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
    if (this.daylight.visible) {
      this.daylight.position.set(viewRect.minX, viewRect.minY);
      this.daylight.width = viewRect.maxX - viewRect.minX;
      this.daylight.height = viewRect.maxY - viewRect.minY;
    }
    this.ground.cull(viewRect);
    this.border.cull(viewRect);
    this.border.update(dt);
    this.agents.update(this.world, this.agentSource(), this.stopSource(), this.lightSource(), viewRect, cam.zoom);
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
    // Shaders hold the atlas pages; let go of them before the textures are destroyed.
    this.ground.destroy();
    releaseTileShaders(this.textures.sources);
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }
}
