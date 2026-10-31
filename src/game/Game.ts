import { worldToTile } from '../render/iso';
import { buildingFrameSize, buildingHeadroom, BUILDING_VARIANTS } from '../render/atlas/buildingArt';
import { BRIDGE_ANCHOR_Y, GROUND_PAD } from '../render/atlas/geometry';
import { Renderer } from '../render/Renderer';
import { BALANCE } from '../shared/balance';
import { HALF_H, SIM_TICK_HZ } from '../shared/constants';
import { BUILDINGS, type BuildingId } from '../sim/buildings/catalog';
import { City } from '../sim/City';
import type { BurstKind } from '../render/fx/Effects';
import { applyClear, applyPlace, applyRoad, planClear, type ApplyResult, type PlannedTile } from '../sim/commands';
import { cityStats, collectBudget, simulateDay, updateRoadAccess } from '../sim/population';
import { rectTiles, roadMask, type TilePos } from '../sim/roads';
import { Traffic } from '../sim/traffic';
import { Decor } from '../sim/terrain/types';
import { generateRiverValley } from '../sim/terrain/riverValley';
import type { World } from '../sim/World';
import { SoundBoard } from './audio';
import { EventBus, type GameEventMap, type InspectInfo } from './events';
import { InputController, type ScreenPoint } from './input/InputController';
import { GameLoop } from './loop';
import { planTool, previewTiles, TOOL_KEYS, type ToolDrag, type ToolId, type ToolPlan } from './tools';

export interface GameOptions {
  size: number;
  seed: number;
  /** Starting money; defaults to BALANCE.startingFunds. */
  funds?: number;
}

/** How often stats are pushed to the UI (they don't need 60 Hz React renders). */
const STATS_INTERVAL = 0.25;
/** The build ripple never takes longer than this, however long the road. */
const MAX_RIPPLE_TIME = 0.5;
/** Particle budget shared across all tiles of one action. */
const PARTICLE_BUDGET = 900;
/** Sim-time multipliers for pause, 1×, 2×, 3× (the fastest step is 4× for a real jump). */
export const GAME_SPEEDS = [0, 1, 2, 4] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Owns City + Renderer + input + loop. The React layer only talks to it via `events` and public methods. */
export class Game {
  readonly events = new EventBus<GameEventMap>();
  readonly city: City;
  readonly sound = new SoundBoard();
  readonly traffic: Traffic;
  private readonly renderer: Renderer;
  private readonly input: InputController;
  private readonly loop: GameLoop;

  private simTick = 0;
  private hovered: TilePos | null = null;
  private toolId: ToolId = 'select';
  private buildingChoice: BuildingId = 'cottage';
  private speedIndex = 1;
  private dayTimer = 0;
  private inspected: number | null = null;
  private drag: ToolDrag | null = null;
  private lastPointer: ScreenPoint | null = null;
  private noticeId = 0;
  private statsTimer = 0;
  private statsFrames = 0;
  private statsTime = 0;

  private constructor(city: City, renderer: Renderer) {
    this.city = city;
    this.renderer = renderer;
    this.input = new InputController(renderer.app.canvas, renderer.camera, {
      onPointer: (p) => this.updateHover(p),
      onKey: (code) => this.onKey(code),
      onPrimaryDown: (p, shift) => this.onPrimaryDown(p, shift),
      onPrimaryMove: (p, shift) => this.onPrimaryMove(p, shift),
      onPrimaryUp: () => this.onPrimaryUp(),
      onCancel: () => this.cancel(),
      onClick: (p) => this.onClick(p),
    });
    this.traffic = new Traffic(city.world, city.world.seed);
    renderer.setAgentSource(() => this.traffic.agents);
    this.loop = new GameLoop(
      SIM_TICK_HZ,
      () => this.tick(),
      (dt) => this.frame(dt),
    );
  }

  static async create(host: HTMLElement, opts: GameOptions): Promise<Game> {
    const world = generateRiverValley({ seed: opts.seed, size: opts.size });
    const renderer = await Renderer.create(host, world);
    const game = new Game(new City(world, opts.funds), renderer);
    game.loop.speed = GAME_SPEEDS[game.speedIndex];
    game.loop.start();
    return game;
  }

  get world(): World {
    return this.city.world;
  }

  get tool(): ToolId {
    return this.toolId;
  }

  get building(): BuildingId {
    return this.buildingChoice;
  }

  /** Pick what the Build tool places (and switch to it). */
  setBuilding(id: BuildingId) {
    this.buildingChoice = id;
    this.events.emit('building', id);
    if (this.toolId !== 'build') this.setTool('build');
    else this.updatePreview();
  }

  private plan(drag: ToolDrag | null, hovered: TilePos | null) {
    return planTool(this.world, this.toolId, drag, hovered, this.buildingChoice);
  }

  // ---------------------------------------------------------------- tools

  setTool(tool: ToolId) {
    if (tool !== this.toolId) this.sound.play('tool');
    this.toolId = tool;
    this.drag = null;
    this.renderer.app.canvas.style.cursor = tool === 'select' ? '' : 'crosshair';
    this.renderer.hover.set(tool === 'select' ? this.hovered : null);
    this.events.emit('tool', tool);
    this.updatePreview();
  }

  private tileAt(screen: ScreenPoint): TilePos {
    const w = this.renderer.camera.screenToWorld(screen.x, screen.y);
    const t = worldToTile(w.x, w.y);
    return {
      x: Math.min(this.world.width - 1, Math.max(0, t.x)),
      y: Math.min(this.world.height - 1, Math.max(0, t.y)),
    };
  }

  private onPrimaryDown(screen: ScreenPoint, shift: boolean): boolean {
    if (this.toolId === 'select') return false;
    const t = this.tileAt(screen);
    this.drag = { start: t, current: t, straight: shift };
    this.lastPointer = screen;
    this.updatePreview();
    return true;
  }

  private onPrimaryMove(screen: ScreenPoint, shift: boolean) {
    if (!this.drag) return;
    const t = this.tileAt(screen);
    this.lastPointer = screen;
    if (t.x === this.drag.current.x && t.y === this.drag.current.y && shift === this.drag.straight) {
      this.emitPreviewLabel();
      return;
    }
    this.drag = { ...this.drag, current: t, straight: shift };
    this.updatePreview();
  }

  private onPrimaryUp() {
    if (!this.drag) return;
    const p = this.plan(this.drag, null);
    this.drag = null;
    if (p) this.execute(p);
    this.updatePreview();
  }

  /** Apply a tool plan: mutate the world, then refresh rendering, sim caches and UI. */
  private execute(p: ToolPlan) {
    // What's on each tile before it changes decides the particles (leaves, grit, dust).
    const debris = this.debrisOf(p.plan.tiles);
    let result: ApplyResult;
    if (p.kind === 'road') result = applyRoad(this.city, p.plan, p.roadType);
    else if (p.kind === 'clear') result = applyClear(this.city, p.plan);
    else result = applyPlace(this.city, p.plan, Math.floor(Math.random() * BUILDING_VARIANTS));

    if (p.kind === 'place' && !p.plan.ok) {
      this.sound.play('error');
      this.notify('error', "Can't build there: needs clear land, no roads or water");
    } else if (result.ok && result.changed) {
      const c = result.changed;
      this.renderer.ground.refresh(c.minX, c.minY, c.maxX, c.maxY);
      this.events.emit('funds', this.city.funds);
      this.buildFeedback(p, result.tiles ?? [], debris);
      this.afterWorldChange(p.kind !== 'place');
    } else if (result.reason === 'insufficient-funds') {
      this.sound.play('error');
      this.notify('error', `Not enough money: needs $${p.plan.cost.toLocaleString()}`);
    }
  }

  /** Roads or buildings changed: recheck road access, warning badges, routes and the info panel. */
  private afterWorldChange(roadsChanged: boolean) {
    updateRoadAccess(this.world);
    this.renderer.indicators.sync(this.world);
    this.traffic.refreshDemand();
    if (roadsChanged) this.traffic.invalidateRoutes();
    if (this.inspected !== null && !this.world.buildings.has(this.inspected)) this.inspect(null);
    this.emitInspect();
    this.emitCity();
  }

  // ---------------------------------------------------------------- simulation

  get speed(): number {
    return this.speedIndex;
  }

  /** 0 = paused, 1–3 = 1×, 2×, 3×. */
  setSpeed(index: number) {
    this.speedIndex = Math.max(0, Math.min(GAME_SPEEDS.length - 1, index));
    this.loop.speed = GAME_SPEEDS[this.speedIndex];
    this.sound.play('tool');
    this.emitCity();
  }

  private lastSpeed = 1;
  togglePause() {
    if (this.speedIndex === 0) this.setSpeed(this.lastSpeed);
    else {
      this.lastSpeed = this.speedIndex;
      this.setSpeed(0);
    }
  }

  private newDay() {
    const city = this.city;
    city.day++;
    simulateDay(this.world);
    this.traffic.refreshDemand();
    if (city.day % BALANCE.daysPerMonth === 0) {
      const r = collectBudget(city);
      this.events.emit('funds', city.funds);
      const month = MONTH_NAMES[(city.date.month + 11) % 12];
      const sign = r.net >= 0 ? '+' : '−';
      this.notify(r.net >= 0 ? 'info' : 'error', `${month} budget: ${sign}$${Math.abs(r.net).toLocaleString()} (taxes $${r.income.toLocaleString()}, upkeep $${r.expenses.toLocaleString()})`);
    }
    this.emitCity();
    this.emitInspect();
  }

  /** Push current city stats to listeners (also used by the UI bridge on connect). */
  emitCity() {
    const s = cityStats(this.world);
    let cars = 0;
    for (const a of this.traffic.agents) if (a.kind !== 'person') cars++;
    this.events.emit('city', {
      ...s,
      date: this.city.date,
      speed: this.speedIndex,
      cars,
      people: this.traffic.agents.length - cars,
    });
  }

  // ---------------------------------------------------------------- inspect

  private onClick(screen: ScreenPoint) {
    if (this.toolId !== 'select') return;
    const t = this.tileAt(screen);
    const id = this.world.building[this.world.index(t.x, t.y)];
    this.inspect(id === -1 ? null : id);
  }

  /** Open the info panel for a building (or close it with null). */
  inspect(id: number | null) {
    if (id !== null && id !== this.inspected) this.sound.play('tool');
    this.inspected = id;
    this.emitInspect();
    this.updatePreview();
  }

  private emitInspect() {
    const b = this.inspected === null ? undefined : this.world.buildings.get(this.inspected);
    if (!b) {
      this.events.emit('inspect', null);
      return;
    }
    const d = BUILDINGS[b.def];
    const info: InspectInfo = {
      id: b.id,
      name: d.name,
      category: d.category,
      level: d.level,
      description: d.description,
      occupants: b.occupants,
      capacity: d.capacity,
      occupantLabel: d.category === 'residential' ? 'Residents' : 'Workers',
      hasRoad: b.entrance !== -1,
      size: d.size,
    };
    this.events.emit('inspect', info);
  }

  /** Bulldoze a whole building (from the info panel). */
  demolish(id: number) {
    const b = this.world.buildings.get(id);
    if (!b) return;
    const { w, h } = BUILDINGS[b.def].size;
    const plan = planClear(this.world, rectTiles({ x: b.x, y: b.y }, { x: b.x + w - 1, y: b.y + h - 1 }));
    this.execute({ kind: 'clear', tool: 'clear', plan });
    this.inspect(null);
  }

  private debrisOf(tiles: readonly PlannedTile[]): Map<number, BurstKind> {
    const w = this.world;
    const out = new Map<number, BurstKind>();
    for (const t of tiles) {
      if (!t.valid) continue;
      const i = w.index(t.x, t.y);
      const d = w.decor[i];
      if (w.tree[i] > 0) out.set(i, 'leaves');
      else if (d === Decor.Rocks || d === Decor.Boulder) out.set(i, 'rocks');
    }
    return out;
  }

  /** Pop + particles rippling along the build order, with matching sound. */
  private buildFeedback(p: ToolPlan, tiles: readonly PlannedTile[], debris: Map<number, BurstKind>) {
    const n = tiles.length;
    if (n === 0) return;
    const fx = this.renderer.effects;
    const stagger = Math.min(0.02, MAX_RIPPLE_TIME / n);
    const perTile = Math.max(1, Math.min(6, Math.floor(PARTICLE_BUDGET / n)));

    tiles.forEach((t, k) => {
      const kind = debris.get(this.world.index(t.x, t.y));
      if (kind) fx.burst(t.x, t.y, kind, perTile, k * stagger);
    });

    if (p.kind === 'place') {
      const id = p.plan.building;
      const { w, h } = BUILDINGS[id].size;
      const b = this.world.buildings.get(this.world.building[this.world.index(p.plan.origin.x, p.plan.origin.y)]);
      if (b) {
        const frame = buildingFrameSize(id);
        fx.pop(
          [
            {
              // Fractional tile coords put the pop at the footprint's centre.
              x: b.x + (w - 1) / 2,
              y: b.y + (h - 1) / 2,
              texture: this.renderer.textures.buildings[id][b.variant],
              anchorY: (buildingHeadroom(id) + GROUND_PAD + ((w + h) * HALF_H) / 2) / frame.h,
            },
          ],
          0,
        );
      }
      tiles.forEach((t, k) => fx.burst(t.x, t.y, 'dust', 6, k * 0.03));
      this.sound.play('build', 0, 0.8);
      return;
    }

    if (p.kind === 'road') {
      const tex = this.renderer.textures;
      const type = p.roadType;
      fx.pop(
        tiles.map((t) => ({
          x: t.x,
          y: t.y,
          texture: t.bridge ? tex.bridges[type][t.bridge] : tex.roads[type][roadMask(this.world, t.x, t.y)],
          anchorY: t.bridge ? BRIDGE_ANCHOR_Y : 0.5,
        })),
        stagger,
      );
      tiles.forEach((t, k) => fx.burst(t.x, t.y, t.bridge ? 'splash' : 'dust', Math.ceil(perTile / 2), k * stagger));
      this.sound.play(tiles.some((t) => t.bridge) ? 'bridge' : 'build');
      // Ticks follow the ripple, rising in pitch.
      const ticks = Math.min(8, n);
      for (let k = 1; k < ticks; k++) this.sound.play('tick', (k / ticks) * n * stagger, 1 + (k / ticks) * 0.35);
    } else {
      tiles.forEach((t, k) => {
        if (!debris.has(this.world.index(t.x, t.y))) fx.burst(t.x, t.y, 'dust', Math.ceil(perTile / 2), k * stagger);
      });
      this.sound.play('clear');
    }
  }

  get muted(): boolean {
    return this.sound.muted;
  }

  setMuted(muted: boolean) {
    this.sound.setMuted(muted);
    this.events.emit('muted', muted);
  }

  /** Right click / Esc: drop the drag if there is one, otherwise put the tool away. */
  cancel() {
    if (this.drag) {
      this.drag = null;
      this.updatePreview();
    } else if (this.toolId !== 'select') {
      this.setTool('select');
    }
  }

  private updatePreview() {
    const p = this.plan(this.drag, this.hovered);
    const inspected = this.toolId === 'select' && this.inspected !== null ? this.world.buildings.get(this.inspected) : undefined;
    if (inspected) {
      // Outline the inspected building's footprint.
      const { w, h } = BUILDINGS[inspected.def].size;
      const tex = this.renderer.textures.selection;
      this.renderer.toolPreview.show(
        rectTiles({ x: inspected.x, y: inspected.y }, { x: inspected.x + w - 1, y: inspected.y + h - 1 }).map((t) => ({
          ...t,
          texture: tex,
          tint: 0x4fd1c5,
          alpha: 0.55,
        })),
      );
    } else if (!p) this.renderer.toolPreview.clear();
    else this.renderer.toolPreview.show(previewTiles(this.world, this.renderer.textures, p));
    this.emitPreviewLabel();
  }

  private emitPreviewLabel() {
    // Drags always show a label; the Build tool also labels the hovered spot before you click.
    const p = this.drag ? this.plan(this.drag, null) : this.toolId === 'build' ? this.plan(null, this.hovered) : null;
    if (!p || !this.lastPointer) {
      this.events.emit('toolPreview', null);
      return;
    }
    this.events.emit('toolPreview', {
      tool: this.toolId,
      label: p.kind === 'place' ? BUILDINGS[p.plan.building].name : null,
      blocked: p.kind === 'place' && !p.plan.ok,
      screen: this.lastPointer,
      cost: p.plan.cost,
      count: p.plan.count,
      affordable: p.plan.cost <= this.city.funds,
    });
  }

  private notify(kind: 'error' | 'info', message: string) {
    this.events.emit('notice', { id: ++this.noticeId, kind, message });
  }

  // ---------------------------------------------------------------- loop

  /** Fixed-step simulation: runs SIM_TICK_HZ × speed times per second (GameLoop handles speed). */
  private tick() {
    this.simTick++;
    this.dayTimer += 1 / SIM_TICK_HZ;
    if (this.dayTimer >= BALANCE.secondsPerDay) {
      this.dayTimer -= BALANCE.secondsPerDay;
      this.newDay();
    }
  }

  private frame(dt: number) {
    this.input.update(dt);
    // Agents move every frame (smooth), scaled by game speed.
    this.traffic.update(dt * GAME_SPEEDS[this.speedIndex]);
    this.renderer.render(dt);

    this.statsFrames++;
    this.statsTime += dt;
    this.statsTimer += dt;
    if (this.statsTimer >= STATS_INTERVAL) {
      const r = this.renderer;
      this.events.emit('stats', {
        fps: this.statsFrames / this.statsTime,
        frameMs: (this.statsTime / this.statsFrames) * 1000,
        drawCalls: r.drawCalls,
        visibleChunks: r.ground.visibleChunks,
        totalChunks: r.ground.totalChunks,
        visibleSprites: r.ground.visibleSprites,
        agents: this.traffic.agents.length,
        agentsDrawn: r.agents.visible,
        bootAtlasMs: r.timings.atlas,
        bootChunksMs: r.timings.chunks,
        zoom: r.camera.zoom,
        mapSize: this.world.width,
        seed: this.world.seed,
        simTick: this.simTick,
      });
      this.statsTimer = 0;
      this.statsFrames = 0;
      this.statsTime = 0;
    }
  }

  private updateHover(screen: ScreenPoint | null) {
    let tile: TilePos | null = null;
    if (screen) {
      const w = this.renderer.camera.screenToWorld(screen.x, screen.y);
      const t = worldToTile(w.x, w.y);
      if (this.world.inBounds(t.x, t.y)) tile = t;
    }
    if (screen && this.toolId === 'build') {
      this.lastPointer = screen;
      if (!this.drag) this.emitPreviewLabel();
    }
    if (tile?.x === this.hovered?.x && tile?.y === this.hovered?.y) return;
    this.hovered = tile;
    this.renderer.hover.set(this.toolId === 'select' ? tile : null);
    this.events.emit('hover', tile);
    if (!this.drag) this.updatePreview();
  }

  private onKey(code: string) {
    if (code === 'KeyG') this.setGrid(!this.renderer.ground.gridOn);
    else if (code === 'KeyM') this.setMuted(!this.sound.muted);
    else if (code === 'Space') this.togglePause();
    else if (code === 'BracketLeft') this.setSpeed(Math.max(1, this.speedIndex - 1));
    else if (code === 'BracketRight') this.setSpeed(this.speedIndex + 1);
    else if (code === 'Escape') {
      if (this.inspected !== null && !this.drag) this.inspect(null);
      else this.cancel();
    }
    else {
      const tool = (Object.keys(TOOL_KEYS) as ToolId[]).find((t) => TOOL_KEYS[t] === code);
      if (tool) this.setTool(tool === this.toolId ? 'select' : tool);
    }
  }

  setGrid(on: boolean) {
    this.renderer.ground.setGrid(on);
    this.events.emit('grid', on);
  }

  destroy() {
    this.loop.stop();
    this.input.destroy();
    this.events.clear();
    this.sound.destroy();
    this.renderer.destroy();
  }
}
