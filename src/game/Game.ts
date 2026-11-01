import { turn, type Rotation } from '../render/view/ViewTransform';
import { buildingFrameSize, buildingHeadroom, BUILDING_VARIANTS } from '../render/atlas/buildingArt';
import { buildingTexture } from '../render/atlas/tiles';
import { BRIDGE_ANCHOR_Y, GROUND_PAD } from '../render/atlas/geometry';
import { Renderer } from '../render/Renderer';
import { BALANCE } from '../shared/balance';
import { HALF_H, SIM_TICK_HZ } from '../shared/constants';
import { BUILDINGS, type BuildingId } from '../sim/buildings/catalog';
import { City } from '../sim/City';
import type { BurstKind } from '../render/fx/Effects';
import { applyClear, applyPlace, applyRoad, applyZone, planClear, type ApplyResult, type PlannedTile } from '../sim/commands';
import { buildDemoCity } from '../sim/demo';
import { tileToWorld } from '../render/iso';
import { isPlaceable, SERVICE_KINDS, type BuildingDef, type BuildingInstance } from '../sim/buildings/catalog';
import { Simulation } from '../sim/core/Simulation';
import type { DayOutcome } from '../sim/core/System';
import { findEntrance } from '../sim/systems/access';
import { serviceBit } from '../sim/systems/coverage';
import { cityStats } from '../sim/systems/population';
import type { Traffic } from '../sim/systems/traffic';
import { needsUtilities } from '../sim/systems/utilities';
import { COMPLAINT_TEXT, NEED_KINDS } from '../sim/systems/needs';
import { happinessColor, type OverlayTile } from '../render/Renderer';
import { rectTiles, roadMask, type TilePos } from '../sim/roads';
import { Decor } from '../sim/terrain/types';
import { generateTerrain } from '../sim/terrain/generate';
import { deserialize, serialize, type SaveData } from '../sim/save';
import type { TerrainSettings } from '../sim/terrain/presets';
import type { World } from '../sim/World';
import { SoundBoard } from './audio';
import { daylightTint, nightness } from '../render/daylight';
import type { Point, ViewTransform } from '../render/view/ViewTransform';
import { EventBus, type DayNightMode, type GameEventMap, type InspectInfo } from './events';
import { InputController, type ScreenPoint } from './input/InputController';
import { GameLoop } from './loop';
import { isZoneTool, planTool, strandedZoneTiles, previewTiles, TOOL_KEYS, type ToolDrag, type ToolId, type ToolPlan } from './tools';

export interface GameOptions {
  /** Preset, seed, size and sliders (see sim/terrain/presets.ts). */
  terrain: TerrainSettings;
  name: string;
  /** Starting money; defaults to BALANCE.startingFunds. */
  funds?: number;
  /** Build the planned demo city on the map before the first frame (the /demo route). */
  demo?: boolean;
  /** Continue a saved city (its terrain settings and name match `terrain` and `name`). */
  save?: SaveData;
}

/** What has changed since a save: player edits and in-game days (src/save/CitySaver.ts). */
export interface ChangeStamp {
  readonly edits: number;
  readonly day: number;
}

/** How often stats are pushed to the UI (they don't need 60 Hz React renders). */
const STATS_INTERVAL = 0.25;
/** The build ripple never takes longer than this, however long the road. */
const MAX_RIPPLE_TIME = 0.5;
/** Particle budget shared across all tiles of one action. */
const PARTICLE_BUDGET = 900;
/** Sim-time multipliers for pause, 1×, 2×, 3×. */
export const GAME_SPEEDS = [0, 1, 2, 3] as const;
const DAY_NIGHT_KEY = 'citybuilder.dayNightMode';
const DAY_NIGHT_MODES: readonly DayNightMode[] = ['cycle', 'day', 'night'];
/** The clock hour shown while the mode is "always night". */
const NIGHT_HOUR = 1;

function readDayNight(): DayNightMode {
  try {
    const v = localStorage.getItem(DAY_NIGHT_KEY);
    return DAY_NIGHT_MODES.find((m) => m === v) ?? 'cycle';
  } catch {
    return 'cycle';
  }
}

/** Cursor-label names for the zone tools. */
const TOOL_LABEL = {
  'zone-r': 'Homes',
  'zone-rh': 'Apartments',
  'zone-c': 'Shops',
  'zone-ch': 'Offices',
  'zone-i': 'Industry',
} as const;
/** Toast ids, unique across game instances (dev mode mounts a game twice, sharing one HUD store). */
let noticeSeq = 0;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Owns City + Renderer + input + loop. The React layer only talks to it via `events` and public methods. */
export class Game {
  readonly events = new EventBus<GameEventMap>();
  readonly city: City;
  readonly sound = new SoundBoard();
  /** The simulation core: every system (access, utilities, growth, traffic …) lives here. */
  readonly sim: Simulation;
  private readonly renderer: Renderer;
  private readonly input: InputController;
  private readonly loop: GameLoop;

  private simTick = 0;
  private hovered: TilePos | null = null;
  private toolId: ToolId = 'select';
  private buildingChoice: BuildingId = 'park';
  private speedIndex = 1;
  private dayTimer = 0;
  private inspected: number | null = null;
  private drag: ToolDrag | null = null;
  private lastPointer: ScreenPoint | null = null;
  private dayNightMode = readDayNight();
  /** The data view shown over the city, if any (roads by congestion, buildings by happiness). */
  private dataView: 'traffic' | 'happiness' | null = null;
  /** Bumped whenever tiles or buildings change, so the minimap knows to repaint. */
  private worldVersion = 0;
  /** Utility hints already shown this game. */
  private readonly hinted = new Set<'power' | 'water'>();
  private statsTimer = 0;
  private statsFrames = 0;
  private statsTime = 0;
  /** Player edits so far (roads, zones, buildings, taxes), for save dirty tracking. */
  private edits = 0;
  private readonly options: GameOptions;

  private constructor(city: City, renderer: Renderer, options: GameOptions) {
    this.city = city;
    this.options = options;
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
    this.sim = new Simulation(city);
    renderer.setAgentSource(
      () => this.traffic.agents,
      () => this.traffic.stops,
      () => this.traffic.lights(),
    );
    renderer.setNeedsSource(() => this.sim.needs.byBuilding);
    this.loop = new GameLoop(
      SIM_TICK_HZ,
      () => this.tick(),
      (dt) => this.frame(dt),
    );
  }

  static async create(host: HTMLElement, opts: GameOptions): Promise<Game> {
    const city = opts.save ? deserialize(opts.save) : new City(generateTerrain(opts.terrain), opts.funds);
    const world = city.world;
    const demo = opts.demo ? buildDemoCity(city, opts.terrain.seed) : null;
    const renderer = await Renderer.create(host, world);
    const game = new Game(city, renderer, opts);
    // Start over downtown (a little zoomed out), or over the middle of a saved city.
    const centre = demo?.centre ?? (opts.save ? buildingsCentre(world) : null);
    if (centre) {
      game.afterWorldChange(true);
      const p = tileToWorld(centre.x, centre.y);
      renderer.camera.jumpTo(p.x, p.y, 0.8);
    }
    game.loop.speed = GAME_SPEEDS[game.speedIndex];
    game.loop.start();
    return game;
  }

  get world(): World {
    return this.city.world;
  }

  /** The city as a save (docs/specs/saving.md). A few ms even for a big city. */
  snapshot(): SaveData {
    return serialize(this.city, this.options.terrain, this.options.name);
  }

  get changeStamp(): ChangeStamp {
    return { edits: this.edits, day: this.city.day };
  }

  get traffic(): Traffic {
    return this.sim.traffic.traffic;
  }

  get tool(): ToolId {
    return this.toolId;
  }

  get building(): BuildingId {
    return this.buildingChoice;
  }

  /** Pick what the Build tool places (and switch to it). */
  setBuilding(id: BuildingId) {
    if (!isPlaceable(id)) return;
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
    this.renderer.setZoneView(isZoneTool(tool));
    this.events.emit('tool', tool);
    this.updatePreview();
  }

  /** World tile under a screen point, clamped to the map (works in any view rotation). */
  private tileAt(screen: ScreenPoint): TilePos {
    return this.renderer.screenToTile(screen.x, screen.y, true) ?? { x: 0, y: 0 };
  }

  // ---------------------------------------------------------------- view rotation

  get rotation(): Rotation {
    return this.renderer.rotation;
  }

  /** Turn the camera a quarter turn (+1 or −1). The city itself doesn't change. */
  rotate(step: 1 | -1) {
    const r = turn(this.renderer.rotation, step);
    this.renderer.setRotation(r);
    this.sound.play('tool');
    this.events.emit('rotation', r);
    this.bumpWorld();
    this.updatePreview();
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
    // Rezoning or dezoning removes grown buildings; they get a puff of dust.
    if (p.kind === 'zone') {
      for (const t of p.plan.tiles) {
        const i = this.world.index(t.x, t.y);
        if (t.valid && this.world.building[i] !== -1) debris.set(i, 'dust');
      }
    }
    let result: ApplyResult;
    if (p.kind === 'road') result = applyRoad(this.city, p.plan, p.roadType);
    else if (p.kind === 'clear') result = applyClear(this.city, p.plan);
    else if (p.kind === 'zone') result = applyZone(this.city, p.plan, p.zone);
    else result = applyPlace(this.city, p.plan, Math.floor(Math.random() * BUILDING_VARIANTS));

    if (p.kind === 'place' && !p.plan.ok) {
      this.sound.play('error');
      this.notify('error', "Can't build there: needs clear land, no roads or water");
    } else if (result.ok && result.changed) {
      this.edits++;
      const c = result.changed;
      // Roads change which zoned lots can grow up to roadAccessRange tiles away; refresh that far.
      const g = p.kind === 'road' || p.kind === 'clear' ? BALANCE.roadAccessRange : 0;
      const rect = { x: c.minX - g, y: c.minY - g, w: c.maxX - c.minX + 1 + 2 * g, h: c.maxY - c.minY + 1 + 2 * g };
      this.renderer.refreshWorld(rect);
      this.events.emit('funds', this.city.funds);
      this.buildFeedback(p, result.tiles ?? [], debris);
      if (p.kind === 'zone') this.warnUnreachableZones(result.tiles ?? []);
      this.afterWorldChange(p.kind === 'road' || p.kind === 'clear');
    } else if (result.reason === 'insufficient-funds') {
      this.sound.play('error');
      this.notify('error', `Not enough money: needs $${p.plan.cost.toLocaleString()}`);
    }
  }

  /** Zones only grow within reach of a road; say so when some of the new zone can't. */
  private warnUnreachableZones(tiles: readonly PlannedTile[]) {
    const far = tiles.filter((t) => findEntrance(this.world, t.x, t.y, 1, 1, BALANCE.roadAccessRange) === -1).length;
    if (far === 0) return;
    const all = far === tiles.length;
    this.notify(
      'info',
      all
        ? `No road nearby: zones grow only within ${BALANCE.roadAccessRange} tiles of a road (R)`
        : `${far} of ${tiles.length} zoned tiles are over ${BALANCE.roadAccessRange} tiles from a road and won't grow`,
    );
  }

  /** Roads or buildings changed by the player: update the systems, then everything on screen. */
  private afterWorldChange(roadsChanged: boolean) {
    this.sim.worldChanged({ roads: roadsChanged });
    this.afterSimChange();
  }

  /** The systems are up to date: refresh the minimap, badges, hints and panels. */
  private afterSimChange() {
    this.bumpWorld();
    this.refreshDataView();
    this.renderer.indicators.sync(this.world);
    this.hintUtilities();
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
    const out = this.sim.day();
    this.showDay(out);
    // Congestion changes every day, even when no buildings did.
    if (out.changed.length === 0) this.refreshDataView();
    const r = out.budget;
    if (r) {
      this.events.emit('funds', this.city.funds);
      const month = MONTH_NAMES[(this.city.date.month + 11) % 12];
      const sign = r.net >= 0 ? '+' : '−';
      this.notify(r.net >= 0 ? 'info' : 'error', `${month} budget: ${sign}$${Math.abs(r.net).toLocaleString()} (taxes $${r.income.toLocaleString()}, upkeep $${r.expenses.toLocaleString()})`);
    }
    this.emitCity();
    this.emitBudget();
    this.emitInspect();
  }

  /**
   * Show a day's outcome: dust for new construction sites, a pop for finished buildings,
   * smoke and a toast for fires. Then refresh what's on screen if anything changed.
   */
  private showDay(out: DayOutcome) {
    if (out.changed.length === 0) return;
    this.renderer.refreshWorld(...out.changed);
    const fx = this.renderer.effects;
    for (const id of out.started) {
      const b = this.world.buildings.get(id);
      if (!b) continue;
      const { w, h } = BUILDINGS[b.def].size;
      for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) fx.burst(x, y, 'dust', 3, Math.random() * 0.3);
    }
    for (const id of out.completed) {
      const b = this.world.buildings.get(id);
      if (b) this.popBuilding(b, 0);
    }
    if (out.abandoned.length > 0) {
      const first = this.world.buildings.get(out.abandoned[0]);
      const name = first ? BUILDINGS[first.def].name : 'building';
      this.notify(
        'error',
        out.abandoned.length === 1
          ? `A ${name} was abandoned: its people were unhappy. See "Citizens say".`
          : `${out.abandoned.length} buildings were abandoned. See "Citizens say".`,
      );
    }
    if (out.burned.length > 0) {
      for (const b of out.burned) {
        const { w, h } = BUILDINGS[b.def].size;
        for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) fx.burst(x, y, 'dust', 10, Math.random() * 0.4);
      }
      this.sound.play('clear');
      const name = BUILDINGS[out.burned[0].def].name;
      this.notify(
        'error',
        out.burned.length === 1 ? `A fire destroyed a ${name}. Build a Fire Station nearby.` : `${out.burned.length} buildings burned down. Build Fire Stations to cover the city.`,
      );
    }
    this.afterSimChange();
  }

  /** The "pop" a building makes when it appears. */
  private popBuilding(b: BuildingInstance, delay: number) {
    const { w, h } = BUILDINGS[b.def].size;
    const frame = buildingFrameSize(b.def, b.variant);
    this.renderer.effects.pop(
      [
        {
          // Fractional tile coords put the pop at the footprint's centre.
          x: b.x + (w - 1) / 2,
          y: b.y + (h - 1) / 2,
          texture: buildingTexture(this.renderer.textures, b.def, b.variant, this.renderer.rotation),
          anchorY: (buildingHeadroom(b.def, b.variant) + GROUND_PAD + ((w + h) * HALF_H) / 2) / frame.h,
        },
      ],
      delay,
    );
  }

  private bumpWorld() {
    this.worldVersion++;
    this.events.emit('worldChanged', this.worldVersion);
  }

  // ---------------------------------------------------------------- minimap & clock

  /** The current view transform (the minimap paints in view space). */
  get view(): ViewTransform {
    return this.renderer.view;
  }

  /** Screen corners in view-tile coordinates. */
  viewportTiles(): Point[] {
    return this.renderer.viewportTiles();
  }

  /** Glide the camera to a view-tile point (minimap click). */
  lookAt(p: Point) {
    this.renderer.panToViewTile(p);
  }

  get trafficView(): boolean {
    return this.dataView === 'traffic';
  }

  /** Show or hide the traffic overlay (roads coloured by congestion). */
  setTrafficView(on: boolean) {
    this.showDataView(on ? 'traffic' : null);
  }

  get happinessView(): boolean {
    return this.dataView === 'happiness';
  }

  /** Show or hide the happiness view (buildings coloured green → red). */
  setHappinessView(on: boolean) {
    this.showDataView(on ? 'happiness' : null);
  }

  private showDataView(view: 'traffic' | 'happiness' | null) {
    this.dataView = view;
    this.refreshDataView();
    this.sound.play('tool');
    this.events.emit('trafficView', view === 'traffic');
    this.events.emit('happinessView', view === 'happiness');
  }

  /** Redraw the active data view from today's numbers. */
  private refreshDataView() {
    if (this.dataView === 'traffic') this.renderer.setTrafficOverlay(this.sim.commute.congestion);
    else if (this.dataView === 'happiness') this.renderer.setDataOverlay(this.happinessTiles());
    else this.renderer.setDataOverlay(null);
  }

  /** Every zoned building's footprint, coloured by its happiness. */
  private happinessTiles(): OverlayTile[] {
    const w = this.world;
    const tiles: OverlayTile[] = [];
    for (const b of w.buildings.values()) {
      const n = this.sim.needs.byBuilding.get(b.id);
      if (!n) continue;
      const color = happinessColor(n.happiness, b.abandoned);
      const { w: bw, h: bh } = BUILDINGS[b.def].size;
      for (let y = b.y; y < b.y + bh; y++) for (let x = b.x; x < b.x + bw; x++) tiles.push({ tile: w.index(x, y), color });
    }
    return tiles;
  }

  /** A building's happiness and need scores for the info panel (null for civic buildings). */
  private needsInfo(id: number): InspectInfo['needs'] {
    const n = this.sim.needs.byBuilding.get(id);
    if (!n) return null;
    return {
      happiness: n.happiness,
      scores: NEED_KINDS.flatMap((kind) => {
        const score = n.scores[kind];
        return score === undefined ? [] : [{ kind, score }];
      }),
      complaint: n.complaint ? COMPLAINT_TEXT[n.complaint] : null,
    };
  }

  /** Glide the camera to a world tile (the Citizens panel's "Show me"). */
  focusTile(x: number, y: number) {
    this.lookAt(this.renderer.view.pointToView(x, y));
  }

  get dayNight(): DayNightMode {
    return this.dayNightMode;
  }

  setDayNight(mode: DayNightMode) {
    this.dayNightMode = mode;
    try {
      localStorage.setItem(DAY_NIGHT_KEY, mode);
    } catch {
      // Storage unavailable: the setting just won't persist.
    }
    this.events.emit('dayNight', mode);
  }

  /** The hour the world is drawn at: the clock, or fixed for "always day/night". */
  private visibleHour(): number | null {
    if (this.dayNightMode === 'day') return null;
    return this.dayNightMode === 'night' ? NIGHT_HOUR : this.city.hour;
  }

  /** Once per game: explain missing power or water the first time homes go without. */
  private hintUtilities() {
    const r = this.sim.utilities.report;
    for (const kind of ['power', 'water'] as const) {
      if (this.hinted.has(kind) || r[kind].short === 0) continue;
      this.hinted.add(kind);
      this.notify(
        'info',
        kind === 'power'
          ? 'Buildings need power: build a Power Plant (Civic → Utilities) on the same roads'
          : 'Buildings need water: build a Water Tower (Civic → Utilities) on the same roads',
      );
    }
  }

  // ---------------------------------------------------------------- budget

  get taxRate(): number {
    return this.city.taxRate;
  }

  setTaxRate(rate: number) {
    this.city.taxRate = Math.max(0, Math.min(BALANCE.maxTaxRate, Math.round(rate)));
    this.edits++;
    this.emitBudget();
    this.emitCity();
  }

  /** Budget panel data: the tax rate, last month's report and what next month looks like now. */
  emitBudget() {
    const u = this.sim.utilities.report;
    this.events.emit('budget', {
      taxRate: this.city.taxRate,
      last: this.sim.budget.last,
      forecast: this.sim.budget.forecast(),
      power: u.power,
      water: u.water,
    });
  }

  /** Push current city stats to listeners (also used by the UI bridge on connect). */
  emitCity() {
    const s = cityStats(this.world);
    let cars = 0;
    for (const a of this.traffic.agents) if (a.kind !== 'person') cars++;
    this.events.emit('city', {
      ...s,
      demand: this.sim.growth.demand(),
      traffic: this.sim.commute.report,
      needs: this.sim.needs.report,
      power: this.sim.utilities.report.power,
      water: this.sim.utilities.report.water,
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
    const d: BuildingDef = BUILDINGS[b.def];
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
      grown: b.grown,
      constructionDays: b.construction,
      needsUtilities: needsUtilities(d),
      powered: b.powered,
      watered: b.watered,
      services: d.category === 'civic' ? [] : SERVICE_KINDS.filter((k) => b.services & serviceBit(k)),
      provides: d.service ? { kind: 'service', service: d.service, radius: d.radius ?? 0 } : d.supplies ? { kind: 'utility', ...d.supplies } : null,
      upkeep: d.upkeep ?? 0,
      commuteMinutes: d.category === 'residential' ? (this.sim.commute.commuteMinutes.get(b.id) ?? null) : null,
      needs: this.needsInfo(b.id),
      abandoned: b.abandoned,
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
      const b = this.world.buildings.get(this.world.building[this.world.index(p.plan.origin.x, p.plan.origin.y)]);
      if (b) this.popBuilding(b, 0);
      tiles.forEach((t, k) => fx.burst(t.x, t.y, 'dust', 6, k * 0.03));
      this.sound.play('build', 0, 0.8);
      return;
    }

    if (p.kind === 'zone') {
      tiles.forEach((t, k) => {
        if (debris.has(this.world.index(t.x, t.y))) fx.burst(t.x, t.y, 'dust', perTile, k * stagger);
      });
      if (debris.size > 0) this.sound.play('clear');
      const ticks = Math.min(6, n);
      for (let k = 0; k < ticks; k++) this.sound.play('tick', (k / ticks) * n * stagger, 1 + (k / ticks) * 0.35);
      return;
    }

    if (p.kind === 'road') {
      const tex = this.renderer.textures;
      const view = this.renderer.view;
      const type = p.roadType;
      fx.pop(
        tiles.map((t) => ({
          x: t.x,
          y: t.y,
          texture: t.bridge
            ? tex.bridges[type][view.bridgeAxis(t.bridge)]
            : tex.roads[type][view.mask(roadMask(this.world, t.x, t.y))],
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
    else this.renderer.toolPreview.show(previewTiles(this.world, this.renderer.textures, p, this.renderer.view));
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
      label: p.kind === 'place' ? BUILDINGS[p.plan.building].name : p.kind === 'zone' ? TOOL_LABEL[p.tool] : null,
      blocked: p.kind === 'place' && !p.plan.ok,
      screen: this.lastPointer,
      cost: p.plan.cost,
      count: p.plan.count,
      affordable: p.plan.cost <= this.city.funds,
      note: this.previewNote(p),
    });
  }

  private previewNote(p: ToolPlan): string | null {
    const stranded = strandedZoneTiles(this.world, p);
    if (stranded === 0) return null;
    return stranded === p.plan.count ? 'needs a road nearby to grow' : `${stranded} tile${stranded === 1 ? '' : 's'} need a road nearby`;
  }

  private notify(kind: 'error' | 'info', message: string) {
    this.events.emit('notice', { id: ++noticeSeq, kind, message });
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
    // The clock and traffic advance every frame, scaled by game speed.
    this.sim.frame(dt * GAME_SPEEDS[this.speedIndex]);
    const hour = this.visibleHour();
    this.renderer.setDaylight(hour === null ? 0xffffff : daylightTint(hour));
    this.renderer.render(dt);

    this.statsFrames++;
    this.statsTime += dt;
    this.statsTimer += dt;
    if (this.statsTimer >= STATS_INTERVAL) {
      const r = this.renderer;
      this.events.emit('clock', this.city.hour);
      this.updateAmbience();
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

  /** Wind when zoomed out, city hum from the cars on screen, birds by day away from traffic. */
  private updateAmbience() {
    const r = this.renderer;
    const z = r.camera.zoom;
    const running = this.speedIndex > 0;
    const cars = r.agents.visible;
    const city = running ? Math.min(1, cars / 60) : 0;
    const hour = this.visibleHour();
    const night = hour === null ? 0 : nightness(hour);
    this.sound.setAmbience({
      wind: Math.min(1, Math.max(0.25, 1.3 - z * 0.7)),
      city,
      birds: (1 - night) * Math.max(0, 1 - cars / 25) * (z > 0.5 ? 1 : 0.4),
    });
  }

  private updateHover(screen: ScreenPoint | null) {
    let tile: TilePos | null = null;
    if (screen) {
      tile = this.renderer.screenToTile(screen.x, screen.y, false);
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
    else if (code === 'KeyT') this.setTrafficView(this.dataView !== 'traffic');
    else if (code === 'KeyY') this.setHappinessView(this.dataView !== 'happiness');
    else if (code === 'KeyL') this.setDayNight(DAY_NIGHT_MODES[(DAY_NIGHT_MODES.indexOf(this.dayNightMode) + 1) % DAY_NIGHT_MODES.length]);
    else if (code === 'Period') this.rotate(1);
    else if (code === 'Comma') this.rotate(-1);
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

/** The centre of a city's buildings (or of the map, if it has none). */
function buildingsCentre(world: World): TilePos {
  let x = 0;
  let y = 0;
  for (const b of world.buildings.values()) {
    x += b.x;
    y += b.y;
  }
  const n = world.buildings.size;
  return n === 0 ? { x: world.width / 2, y: world.height / 2 } : { x: Math.round(x / n), y: Math.round(y / n) };
}
