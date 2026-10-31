import { worldToTile } from '../render/iso';
import { Renderer } from '../render/Renderer';
import { SIM_TICK_HZ } from '../shared/constants';
import { generateRiverValley } from '../sim/terrain/riverValley';
import type { World } from '../sim/World';
import { EventBus, type GameEventMap } from './events';
import { InputController } from './input/InputController';
import { GameLoop } from './loop';

export interface GameOptions {
  size: number;
  seed: number;
}

/** How often stats are pushed to the UI (they don't need 60 Hz React renders). */
const STATS_INTERVAL = 0.25;

/** Owns World + Renderer + input + loop. The React layer only talks to it via `events`. */
export class Game {
  readonly events = new EventBus<GameEventMap>();
  readonly world: World;
  private readonly renderer: Renderer;
  private readonly input: InputController;
  private readonly loop: GameLoop;

  private simTick = 0;
  private hovered: { x: number; y: number } | null = null;
  private statsTimer = 0;
  private statsFrames = 0;
  private statsTime = 0;

  private constructor(world: World, renderer: Renderer) {
    this.world = world;
    this.renderer = renderer;
    this.input = new InputController(renderer.app.canvas, renderer.camera, {
      onPointer: (p) => this.updateHover(p),
      onKey: (code) => this.onKey(code),
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
    const game = new Game(world, renderer);
    game.loop.start();
    return game;
  }

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

  private updateHover(screen: { x: number; y: number } | null) {
    let tile: { x: number; y: number } | null = null;
    if (screen) {
      const w = this.renderer.camera.screenToWorld(screen.x, screen.y);
      const t = worldToTile(w.x, w.y);
      if (this.world.inBounds(t.x, t.y)) tile = t;
    }
    if (tile?.x === this.hovered?.x && tile?.y === this.hovered?.y) return;
    this.hovered = tile;
    this.renderer.hover.set(tile);
    this.events.emit('hover', tile);
  }

  private onKey(code: string) {
    if (code === 'KeyG') this.setGrid(!this.renderer.ground.gridOn);
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
