import { paintMinimap } from '../../render/minimap';
import { ViewTransform } from '../../render/view/ViewTransform';
import { storeFor } from '../../save/CitySaver';
import type { StoreKind } from '../../save/SaveStore';
import type { SaveMeta } from '../../shared/api';
import { deserialize } from '../../sim/save';

/**
 * Map previews of saved cities for the start screen: terrain plus the player's roads, zones and
 * buildings. Each one loads the save and regenerates its terrain (~10–40 ms), so they are made
 * one at a time with a pause between, and cached as image URLs until the save changes.
 */

const W = 360;
const H = 196;
const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 16));

async function render(store: StoreKind, id: number): Promise<string> {
  const { data } = await storeFor(store).load(id);
  const world = deserialize(data).world;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  paintMinimap(ctx, world, new ViewTransform(world.width, world.height, 0), canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** The preview's image URL (rejects if the save can't be read). */
export function cityThumb(store: StoreKind, meta: SaveMeta): Promise<string> {
  const key = `${store}:${meta.id}:${meta.updatedAt}`;
  let url = cache.get(key);
  if (!url) {
    const job = queue.then(() => render(store, meta.id));
    queue = job.catch(() => undefined).then(pause);
    url = job;
    cache.set(key, url);
  }
  return url;
}
