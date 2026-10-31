import { Container, Geometry, Mesh, Shader, type Texture, type TextureSource } from 'pixi.js';
import { HALF_H, HALF_W, TILE_H, TILE_W } from '../../shared/constants';
import { GROUND_PAD } from '../atlas/geometry';

/**
 * Sloped tile quads (docs/specs/elevation.md, "Rendering"). Ground-sized atlas frames
 * (a 64×32 diamond with GROUND_PAD margin) are drawn as diamond meshes whose corners
 * follow the terrain heights. Quads sharing an atlas page merge into one mesh, drawn by
 * a small shader with a per-vertex colour (hill light, zone tint, alpha) and fog.
 */

export interface Vec {
  x: number;
  y: number;
}

/** Premultiplied RGBA per vertex: [r, g, b, a] with rgb already × a. */
export type Rgba = readonly [number, number, number, number];

/** Colour the borderland fog fades into (the app background, --bg-app). */
const FOG: readonly [number, number, number] = [0.051, 0.067, 0.09];

const vertex = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec4 aColor;
in float aFog;
out vec2 vUV;
out vec4 vColor;
out float vFog;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform mat3 uTransformMatrix;
uniform vec4 uColor;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vColor = aColor * uColor * uWorldColorAlpha;
  vFog = aFog;
}`;

const fragment = /* glsl */ `
in vec2 vUV;
in vec4 vColor;
in float vFog;
uniform sampler2D uTexture;
out vec4 finalColor;
void main() {
  vec4 c = texture(uTexture, vUV) * vColor;
  // Fog: desaturate, then fade toward the background (premultiplied, so scale by alpha).
  float grey = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 rgb = mix(c.rgb, vec3(grey), vFog * 0.6);
  rgb = mix(rgb, vec3(${FOG.map((v) => v.toFixed(3)).join(', ')}) * c.a, vFog);
  finalColor = vec4(rgb, c.a);
}`;

const shaders = new Map<TextureSource, Shader>();

function shaderFor(source: TextureSource): Shader {
  let s = shaders.get(source);
  if (!s) {
    s = Shader.from({ gl: { vertex, fragment, name: 'tile-mesh' }, resources: { uTexture: source } });
    shaders.set(source, s);
  }
  return s;
}

/** Destroy every cached shader; call before the atlas textures are destroyed. */
export function releaseTileShaders() {
  for (const s of shaders.values()) s.destroy();
  shaders.clear();
}

/** Frame-space points of the padded diamond, grown by `g` (2:1, so x grows twice as fast). */
function frameDiamond(g: number): readonly Vec[] {
  const cx = GROUND_PAD + HALF_W;
  const cy = GROUND_PAD + HALF_H;
  return [
    { x: cx, y: GROUND_PAD - g },
    { x: GROUND_PAD + TILE_W + 2 * g, y: cy },
    { x: cx, y: GROUND_PAD + TILE_H + g },
    { x: GROUND_PAD - 2 * g, y: cy },
    { x: cx, y: cy },
  ];
}

const DIAMOND_CACHE = new Map<number, readonly Vec[]>();

interface Group {
  pos: number[];
  uv: number[];
  color: number[];
  fog: number[];
  index: number[];
}

/** A diamond quad: corners top, right, bottom, left, then the centre; drawn as a 4-triangle fan. */
export interface Quad {
  texture: Texture;
  /** Screen-world positions of top, right, bottom, left, centre (already lifted by height). */
  points: readonly Vec[];
  /** Per-vertex colour in the same order (premultiplied). */
  colors: readonly Rgba[];
  /** Per-vertex fog 0..1 (optional; 0 = none). */
  fog?: readonly number[];
  /** Over-draw past the diamond edge in px, so neighbouring quads overlap and never seam. */
  grow: number;
}

/** Where a quad's vertices live inside a built mesh (to rewrite its UVs later, e.g. water). */
export interface QuadSlot {
  mesh: Mesh<Geometry, Shader>;
  /** Index of the quad's first vertex. */
  vertex: number;
  grow: number;
}

export class QuadBatch {
  private readonly groups = new Map<TextureSource, Group>();
  private readonly pending: { source: TextureSource; vertex: number; grow: number; onSlot: (s: QuadSlot) => void }[] = [];

  get empty(): boolean {
    return this.groups.size === 0;
  }

  /** Add a quad. `onSlot` is called after build() with where it ended up (for animated quads). */
  add(q: Quad, onSlot?: (s: QuadSlot) => void) {
    const source = q.texture.source;
    let g = this.groups.get(source);
    if (!g) {
      g = { pos: [], uv: [], color: [], fog: [], index: [] };
      this.groups.set(source, g);
    }
    const base = g.pos.length / 2;
    const [dt, dr, db, dl] = [
      { x: 0, y: -q.grow },
      { x: 2 * q.grow, y: 0 },
      { x: 0, y: q.grow },
      { x: -2 * q.grow, y: 0 },
    ];
    const offs = [dt, dr, db, dl, { x: 0, y: 0 }];
    for (let k = 0; k < 5; k++) {
      g.pos.push(q.points[k].x + offs[k].x, q.points[k].y + offs[k].y);
      const c = q.colors[k];
      g.color.push(c[0], c[1], c[2], c[3]);
      g.fog.push(q.fog?.[k] ?? 0);
    }
    pushUVs(g.uv, q.texture, q.grow);
    const c = base + 4;
    g.index.push(c, base, base + 1, c, base + 1, base + 2, c, base + 2, base + 3, c, base + 3, base);
    if (onSlot) this.pending.push({ source, vertex: base, grow: q.grow, onSlot });
  }

  /** One mesh per atlas page, in a container. The batch can't be reused afterwards. */
  build(): Container {
    const out = new Container();
    const meshes = new Map<TextureSource, Mesh<Geometry, Shader>>();
    for (const [source, g] of this.groups) {
      const geometry = new Geometry({
        attributes: {
          aPosition: { buffer: new Float32Array(g.pos), format: 'float32x2' },
          aUV: { buffer: new Float32Array(g.uv), format: 'float32x2' },
          aColor: { buffer: new Float32Array(g.color), format: 'float32x4' },
          aFog: { buffer: new Float32Array(g.fog), format: 'float32' },
        },
        indexBuffer: new Uint32Array(g.index),
      });
      const mesh = new Mesh({ geometry, shader: shaderFor(source) });
      meshes.set(source, mesh);
      out.addChild(mesh);
    }
    for (const p of this.pending) {
      const mesh = meshes.get(p.source);
      if (mesh) p.onSlot({ mesh, vertex: p.vertex, grow: p.grow });
    }
    this.groups.clear();
    this.pending.length = 0;
    return out;
  }
}

function pushUVs(out: number[], texture: Texture, grow: number) {
  let d = DIAMOND_CACHE.get(grow);
  if (!d) {
    d = frameDiamond(grow);
    DIAMOND_CACHE.set(grow, d);
  }
  const f = texture.frame;
  const sw = texture.source.width;
  const sh = texture.source.height;
  for (const p of d) out.push((f.x + p.x) / sw, (f.y + p.y) / sh);
}

/** Point a quad slot at a different frame on the same atlas page (water animation). Call `flush` after. */
export function setQuadTexture(slot: QuadSlot, texture: Texture) {
  const buffer = slot.mesh.geometry.getAttribute('aUV').buffer;
  const data = buffer.data;
  if (!(data instanceof Float32Array)) return;
  const tmp: number[] = [];
  pushUVs(tmp, texture, slot.grow);
  data.set(tmp, slot.vertex * 2);
}

/** Upload changed UVs for a mesh (once per animation step, not per quad). */
export function flushUVs(mesh: Mesh<Geometry, Shader>) {
  mesh.geometry.getAttribute('aUV').buffer.update();
}

/** Grey shade as a premultiplied colour. */
export function shadeColor(shade: number, alpha = 1): Rgba {
  return [shade * alpha, shade * alpha, shade * alpha, alpha];
}

/** A hex tint with alpha as a premultiplied colour. */
export function tintColor(tint: number, alpha: number): Rgba {
  return [(((tint >> 16) & 255) / 255) * alpha, (((tint >> 8) & 255) / 255) * alpha, ((tint & 255) / 255) * alpha, alpha];
}
