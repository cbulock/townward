import { worldToTile } from '../render/iso';
import { Renderer } from '../render/Renderer';
import { SIM_TICK_HZ } from '../shared/constants';
import { City } from '../sim/City';
import { applyClear, applyRoad, type ApplyResult } from '../sim/commands';
import type { TilePos } from '../sim/roads';
import { generateRiverValley } from '../sim/terrain/riverValley';
import type { World } from '../sim/World';
import { EventBus, type GameEventMap } from './events';
import { InputController, type ScreenPoint } from './input/InputController';
import { GameLoop } from './loop';
import { planTool, previewTiles, TOOL_KEYS, type ToolDrag, type ToolId } from './tools';

export interface GameOptions {
  size: number;
  seed: number;
}

/** How often stats are pushed to the UI (they don't need 60 Hz React renders). */
const STATS_INTERVAL = 0.25;

/** Owns City + Renderer + input + loop. The React layer only talks to it via `events` and public methods. */
export class Game {
  readonly events = new EventBus<GameEventMap>();
  readonly city: City;
  private readonly renderer: Renderer;
  private readonly input: InputController;
  private readonly loop: GameLoop;

  private simTick = 0;
  private hovered: TilePos | null = null;
  private toolId: ToolId = 'select';
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
    });
    this.loop = new GameLoop(
      SIM_TICK_HZ,
      () => this.tick(),
      (dt) => this.frame(dt),
    );
  }

  static async create(host: HTMLElement, opts: GameOptions): Promise<Game> {
    const world = generateRiverValley({ seed: opts.seed, size: opts.size });
    const renderer = await Renderer.create(host, world);
    const game = new Game(new City(world), renderer);
    game.loop.start();
    return game;
  }

  get world(): World {
    return this.city.world;
  }

  get tool(): ToolId {
    return this.toolId;
  }

  // ---------------------------------------------------------------- tools

  setTool(tool: ToolId) {
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
    const p = planTool(this.world, this.toolId, this.drag, null);
    this.drag = null;
    if (p) {
      const result: ApplyResult =
        p.roadType !== null ? applyRoad(this.city, p.plan, p.roadType) : applyClear(this.city, p.plan);
      if (result.ok && result.changed) {
        const c = result.changed;
        this.renderer.ground.refresh(c.minX, c.minY, c.maxX, c.maxY);
        this.events.emit('funds', this.city.funds);
      } else if (result.reason === 'insufficient-funds') {
        this.notify('error', `Not enough money: needs $${p.plan.cost.toLocaleString()}`);
      }
    }
    this.updatePreview();
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
    const p = planTool(this.world, this.toolId, this.drag, this.hovered);
    if (!p) this.renderer.toolPreview.clear();
    else this.renderer.toolPreview.show(previewTiles(this.world, this.renderer.textures, p));
    this.emitPreviewLabel();
  }

  private emitPreviewLabel() {
    const p = this.drag && planTool(this.world, this.toolId, this.drag, null);
    if (!p || !this.lastPointer) {
      this.events.emit('toolPreview', null);
      return;
    }
    this.events.emit('toolPreview', {
      tool: this.toolId,
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

  private tick() {
    this.simTick++;
  }

  private frame(dt: number) {
    this.input.update(dt);
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
    if (tile?.x === this.hovered?.x && tile?.y === this.hovered?.y) return;
    this.hovered = tile;
    this.renderer.hover.set(this.toolId === 'select' ? tile : null);
    this.events.emit('hover', tile);
    if (!this.drag) this.updatePreview();
  }

  private onKey(code: string) {
    if (code === 'KeyG') this.setGrid(!this.renderer.ground.gridOn);
    else if (code === 'Escape') this.cancel();
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
    this.renderer.destroy();
  }
}
