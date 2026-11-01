import { Container } from 'pixi.js';
import type { AmbientTextures } from '../atlas/tiles';
import type { Rect } from '../Camera';
import type { ViewRef } from '../Renderer';
import { Beacons } from './Beacons';
import { Birds } from './Birds';
import { Clouds } from './Clouds';
import { Fountains } from './Fountains';
import { eveningLevel } from './nightLights';

/**
 * The city's ambient life (D-072), on top of the static chunks:
 *   lower (under the night tint, like the objects): cloud shadows and fountain spray;
 *   upper (above it): blinking mast beacons and birds.
 * Window lights and swaying trees live in the chunks themselves (ChunkRenderer.animate), because
 * they must sort with the buildings and trees they belong to.
 */
export class Ambient {
  readonly lower = new Container();
  readonly upper = new Container();
  private readonly clouds: Clouds;
  private readonly fountains: Fountains;
  private readonly beacons: Beacons;
  private readonly birds: Birds;

  constructor(tex: AmbientTextures, viewRef: ViewRef) {
    this.clouds = new Clouds(tex.cloud);
    this.fountains = new Fountains(tex.drop, viewRef);
    this.beacons = new Beacons(tex.beacon, viewRef);
    this.birds = new Birds(tex.bird);
    this.lower.addChild(this.clouds.container, this.fountains.container);
    this.upper.addChild(this.beacons.container, this.birds.container);
  }

  /** Re-read marks now (after edits or a rotation). */
  invalidate() {
    this.fountains.invalidate();
    this.beacons.invalidate();
  }

  update(dt: number, view: Rect, zoom: number, daylight: number) {
    const level = eveningLevel(daylight);
    this.clouds.update(dt, view, level);
    this.fountains.update(dt, view, zoom);
    this.beacons.update(dt, view, level);
    this.birds.update(dt, view, zoom, level);
  }
}
