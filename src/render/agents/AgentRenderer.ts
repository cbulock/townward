import { Container, Sprite } from 'pixi.js';
import { agentPose, type Agent, type BusStop } from '../../sim/traffic';
import type { World } from '../../sim/World';
import type { Rect } from '../Camera';
import { VEHICLE_ANCHOR_Y } from '../atlas/agentArt';
import { STOP_ANCHOR } from '../atlas/stopArt';
import type { TerrainTextures } from '../atlas/tiles';
import { tileToWorld } from '../iso';
import type { ViewRef } from '../Renderer';

/** Below these zoom levels agents are too small to read, so they're skipped entirely. */
const MIN_ZOOM_VEHICLES = 0.32;
const MIN_ZOOM_PEOPLE = 0.6;
/** Walk-cycle frame length in seconds. */
const STEP_TIME = 0.22;
/** Cull margin around the view (world px), so agents don't pop at the screen edge. */
const MARGIN = 40;

/**
 * Draws cars and pedestrians from sim/traffic.ts. Sprites are pooled and only
 * on-screen agents get one; the layer sorts by depth (x + y) so agents overlap
 * each other correctly. It sits under the objects layer, so trees and buildings
 * in front of a road cover the cars behind them.
 */
export class AgentRenderer {
  readonly container = new Container({ sortableChildren: true });
  private readonly pool: Sprite[] = [];
  private readonly stopPool: Sprite[] = [];
  visible = 0;

  constructor(
    private readonly tex: TerrainTextures,
    private readonly viewRef: ViewRef,
  ) {}

  update(world: World, agents: readonly Agent[], stops: readonly BusStop[], view: Rect, zoom: number) {
    this.drawStops(world, zoom >= MIN_ZOOM_VEHICLES ? stops : [], view);
    let used = 0;
    if (zoom >= MIN_ZOOM_VEHICLES) {
      const people = zoom >= MIN_ZOOM_PEOPLE;
      for (const a of agents) {
        const isPerson = a.kind === 'person';
        if (isPerson && !people) continue;
        const pose = agentPose(world, a);
        const vt = this.viewRef.current;
        const vp = vt.pointToView(pose.x, pose.y);
        const p = tileToWorld(vp.x, vp.y);
        if (p.x < view.minX - MARGIN || p.x > view.maxX + MARGIN || p.y < view.minY - MARGIN || p.y > view.maxY + MARGIN) continue;

        let s = this.pool[used];
        if (!s) {
          s = new Sprite();
          this.pool.push(s);
          this.container.addChild(s);
        }
        used++;
        if (a.kind === 'person') {
          s.texture = this.tex.people[a.variant % this.tex.people.length][Math.floor(a.age / STEP_TIME) % 2];
          s.anchor.set(0.5, 1);
        } else {
          s.texture = this.tex.vehicles[a.kind][a.variant % 6][vt.dir(pose.dir)];
          s.anchor.set(0.5, VEHICLE_ANCHOR_Y);
        }
        s.position.set(p.x, p.y);
        s.zIndex = vp.x + vp.y;
        s.visible = true;
      }
    }
    for (let k = used; k < this.pool.length; k++) this.pool[k].visible = false;
    this.visible = used;
  }

  /** Shelters sort with the agents (by their spot on the pavement), so cars pass in front or behind correctly. */
  private drawStops(world: World, stops: readonly BusStop[], view: Rect) {
    const vt = this.viewRef.current;
    let used = 0;
    for (const stop of stops) {
      const x = stop.tile % world.width;
      const y = (stop.tile - x) / world.width;
      const vtile = vt.tileToView(x, y);
      const p = tileToWorld(vtile.x, vtile.y);
      if (p.x < view.minX - MARGIN || p.x > view.maxX + MARGIN || p.y < view.minY - MARGIN || p.y > view.maxY + MARGIN) continue;
      const side = vt.dir(stop.side);
      let s = this.stopPool[used];
      if (!s) {
        s = new Sprite();
        s.anchor.set(STOP_ANCHOR.x, STOP_ANCHOR.y);
        this.stopPool.push(s);
        this.container.addChild(s);
      }
      used++;
      s.texture = this.tex.busStops[side];
      s.position.set(p.x, p.y);
      // Depth of the shelter's spot: tile centre pushed toward its side.
      const push = [
        [0, -0.4],
        [0.4, 0],
        [0, 0.4],
        [-0.4, 0],
      ][side];
      s.zIndex = vtile.x + 0.5 + push[0] + vtile.y + 0.5 + push[1];
      s.visible = true;
    }
    for (let k = used; k < this.stopPool.length; k++) this.stopPool[k].visible = false;
  }
}
