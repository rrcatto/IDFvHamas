import {
  AbstractMesh, AssetContainer, Color3, DynamicTexture, Mesh, MeshBuilder, PBRMaterial, Scene, Texture, TransformNode, Vector3,
} from '../babylon';
import { Vector4 } from '@babylonjs/core/Maths/math.vector';
import { Navigation, type Collider, type Point, type Ramp } from './navigation';
import type { Materials, Surface } from './materials';
import type { Environment } from './environment';
import type { ModelName } from '../assets';

export type Side = 'n' | 's' | 'e' | 'w';
/** Storey heights shared by every building and by the navigation tests. */
export const STOREY = { gf: 3.3, f1: 3.65, roofBase: 6.6, roofTop: 6.9, wall: 0.3, stairLen: 8, stairW: 2.3, door: 2.0 };

/** Footprint (metres, Babylon space) and surface of each GLB prop; also used for headless collision. */
export const PROP_INFO: Partial<Record<ModelName, { w: number; d: number; h: number; surface: Surface }>> = {
  barrel: { w: 0.58, d: 0.58, h: 0.88, surface: 'metal' },
  jersey: { w: 1.55, d: 0.64, h: 0.84, surface: 'concrete' },
  militaryCrate: { w: 1.24, d: 0.52, h: 0.47, surface: 'wood' },
  medicalBox: { w: 0.53, d: 0.35, h: 0.1, surface: 'metal' },
  ammoBox: { w: 0.09, d: 0.26, h: 0.18, surface: 'metal' },
  tyre: { w: 0.6, d: 0.17, h: 0.6, surface: 'fabric' },
  jerrycan: { w: 0.35, d: 0.17, h: 0.46, surface: 'metal' },
  lpg: { w: 0.41, d: 0.41, h: 0.64, surface: 'metal' },
  propane: { w: 0.34, d: 0.34, h: 0.55, surface: 'metal' },
  plasticCrate: { w: 0.3, d: 0.41, h: 0.26, surface: 'fabric' },
  plasticCrate3: { w: 0.48, d: 0.27, h: 0.27, surface: 'fabric' },
  cardboard: { w: 0.39, d: 0.52, h: 0.34, surface: 'fabric' },
  trashbag: { w: 0.53, d: 0.46, h: 0.58, surface: 'fabric' },
  dumpster: { w: 1.85, d: 0.56, h: 0.91, surface: 'metal' },
  utilityBox: { w: 0.52, d: 0.43, h: 1.12, surface: 'metal' },
  streetLamp: { w: 0.3, d: 0.3, h: 3.87, surface: 'metal' },
  shutterDoor: { w: 3.08, d: 0.3, h: 2.4, surface: 'metal' },
  chair: { w: 0.64, d: 0.63, h: 0.88, surface: 'fabric' },
  table: { w: 1.13, d: 0.71, h: 0.8, surface: 'wood' },
  generator: { w: 0.82, d: 0.56, h: 0.58, surface: 'metal' },
  bush: { w: 2.28, d: 0.84, h: 0.54, surface: 'fabric' },
  sedanBurnt: { w: 1.81, d: 4.22, h: 1.18, surface: 'metal' },
  hatchRust: { w: 1.64, d: 3.31, h: 1.15, surface: 'metal' },
  pickupBurnt: { w: 2.31, d: 5.18, h: 1.85, surface: 'metal' },
  carBroken: { w: 2.64, d: 5.49, h: 1.76, surface: 'metal' },
};

type BoxOpts = { collide?: boolean; rotY?: number; rotX?: number; rotZ?: number; shadow?: boolean; uv?: 'world' | 'random'; name?: string };
type Opening = { side: Side; u0: number; u1: number; bottom: number; top: number; floor: 0 | 1; kind: 'door' | 'window' | 'shop' | 'hole' };
export type ShopSpec = [Side, number, number, ('open' | 'half' | 'closed')?];
export type BuildingSpec = {
  x: number; z: number; w: number; d: number;
  wall: string; upperWall?: string; inner?: string; trim?: string; floor?: string; upperFloor?: string;
  doors: [Side, number][];
  shops?: ShopSpec[];
  stairs: { kind: 'inner' | 'outer'; side: Side; at?: number };
  partition?: { axis: 'x' | 'z'; at: number; door: number };
  damage?: { corner?: 'ne' | 'nw' | 'se' | 'sw'; holes?: [Side, number, 0 | 1][]; roofless?: boolean; burnt?: boolean };
  balcony?: [Side, number][];
  bridgeDoors?: [Side, number][];
  windows?: number;
  sign?: string;
  spawns?: number;
  roofDetail?: boolean;
};
export type Decal = { tex: string; mesh: Mesh };

/**
 * Low-level construction kit. With a scene it creates textured meshes; with `scene = null` it only
 * records collision, platforms, ramps and spawns so layouts can be validated in Node tests.
 */
export class Kit {
  nav = new Navigation();
  enemySpawns: Point[] = [];
  private spawnGroups: { n: number; pts: Point[] }[] = [];
  staticMeshes: Mesh[] = [];
  dynamicRoots: TransformNode[] = [];
  firePoints: { at: Vector3; scale: number; light: boolean }[] = [];
  /** Approach zones in front of and behind every ground-floor doorway; clutter is never placed in them. */
  doorZones: { x0: number; x1: number; z0: number; z1: number }[] = [];
  /** True when a footprint centred on (x, z) would intrude into a doorway approach. */
  blocksDoor(x: number, z: number, w: number, d: number) {
    return this.doorZones.some(r => x + w / 2 > r.x0 && x - w / 2 < r.x1 && z + d / 2 > r.z0 && z - d / 2 < r.z1);
  }
  decals: Decal[] = [];
  private seed: number;
  private decalMats = new Map<string, PBRMaterial>();
  private grime?: Texture;
  private signCount = 0;
  constructor(public scene: Scene | null, public mats: Materials | null, seed: number, public env?: Environment, public models?: Partial<Record<ModelName, AssetContainer>>) {
    this.seed = seed;
  }
  rand() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  range(a: number, b: number) { return a + (b - a) * this.rand(); }
  pick<T>(items: T[]) { return items[Math.floor(this.rand() * items.length) % items.length]; }

  collider(x: number, z: number, w: number, d: number, bottom: number, top: number) {
    const c: Collider = { x, z, w, d, bottom, top, active: true };
    this.nav.colliders.push(c); return c;
  }
  platform(x: number, z: number, w: number, d: number, top: number) {
    this.nav.platforms.push({ x, z, w, d, bottom: top - 0.35, top, active: true });
  }
  private material(key: string) {
    // key format: surface[@#tint][!in]  (interior surfaces receive less sky light)
    const interior = key.endsWith('!in'); const k = interior ? key.slice(0, -3) : key;
    if (k.startsWith('flat:')) { const [, name, hex, rough, metal] = k.split(':'); return this.mats!.flat(name, hex, Number(rough ?? .85), Number(metal ?? 0)); }
    const [id, tint] = k.split('@');
    return this.mats!.get(id, tint, interior);
  }
  surface(key: string): Surface {
    if (key.startsWith('flat:')) return Number(key.split(':')[4] ?? 0) > 0.4 ? 'metal' : 'concrete';
    return this.mats?.spec(key.split('@')[0].replace('!in', ''))?.surface ?? 'concrete';
  }

  /** Axis-aligned (or Y-rotated) textured box with world-scaled UVs. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, mat: string, o: BoxOpts = {}) {
    const collide = o.collide ?? true;
    if (collide) {
      const r = o.rotY ?? 0, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
      this.collider(x, z, w * c + d * s, w * s + d * c, y - h / 2, y + h / 2);
    }
    if (!this.scene) return null;
    const material = this.material(mat);
    const tile = this.mats!.spec(mat.split('@')[0].replace('!in', ''))?.tile ?? 2;
    let ox = (x - w / 2) / tile, oy = (y - h / 2) / tile, oz = (z - d / 2) / tile;
    if (o.uv === 'random' || o.rotY || o.rotX || o.rotZ) { ox = this.rand(); oy = this.rand(); oz = this.rand(); }
    const fx = new Vector4(ox, oy, ox + w / tile, oy + h / tile), fz = new Vector4(oz, oy, oz + d / tile, oy + h / tile);
    const top = new Vector4(ox, oz, ox + w / tile, oz + d / tile);
    const mesh = MeshBuilder.CreateBox(o.name ?? 'env', { width: w, height: h, depth: d, faceUV: [fx, fx, fz, fz, top, top], wrap: true }, this.scene);
    mesh.position.set(x, y, z);
    if (o.rotY || o.rotX || o.rotZ) mesh.rotation.set(o.rotX ?? 0, o.rotY ?? 0, o.rotZ ?? 0);
    mesh.material = material; mesh.receiveShadows = true; mesh.computeWorldMatrix(true);
    mesh.metadata = { solid: collide || (o.shadow ?? false), surface: this.surface(mat), static: true };
    if ((o.shadow ?? (h > 0.25 || w * d > 6)) && this.env) this.env.caster(mesh);
    this.staticMeshes.push(mesh);
    return mesh;
  }
  cylinder(x: number, y: number, z: number, diameter: number, height: number, mat: string, o: BoxOpts & { tess?: number; axis?: 'x' | 'y' | 'z' } = {}) {
    if (o.collide) this.collider(x, z, o.axis === 'x' ? height : diameter, o.axis === 'z' ? height : diameter, y - (o.axis && o.axis !== 'y' ? diameter : height) / 2, y + (o.axis && o.axis !== 'y' ? diameter : height) / 2);
    if (!this.scene) return null;
    const mesh = MeshBuilder.CreateCylinder(o.name ?? 'env-cyl', { diameter, height, tessellation: o.tess ?? 14 }, this.scene);
    mesh.position.set(x, y, z);
    if (o.axis === 'x') mesh.rotation.z = Math.PI / 2; else if (o.axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (o.rotY) mesh.rotation.y = o.rotY;
    mesh.material = this.material(mat); mesh.receiveShadows = true;
    mesh.metadata = { solid: !!o.collide, surface: this.surface(mat), static: true };
    if (o.shadow ?? true) this.env?.caster(mesh);
    this.staticMeshes.push(mesh);
    return mesh;
  }
  /** Floor or road surface; y is the top. Not a collider. */
  ground(x0: number, z0: number, x1: number, z1: number, mat: string, top = 0.0) {
    return this.box((x0 + x1) / 2, top - 0.1, (z0 + z1) / 2, x1 - x0, 0.2, z1 - z0, mat, { collide: false, shadow: false });
  }
  /** Walkable slab: collision volume plus a navigation platform. */
  slab(x: number, z: number, w: number, d: number, top: number, thick: number, mat: string, floorMat?: string) {
    this.box(x, top - thick / 2 - (floorMat ? 0.03 : 0), z, w, thick - (floorMat ? 0.06 : 0), d, mat, { collide: false, shadow: true });
    this.collider(x, z, w, d, top - thick, top);
    if (floorMat) this.box(x, top - 0.03, z, w, 0.06, d, floorMat, { collide: false, shadow: false });
    this.platform(x, z, w, d, top);
  }
  /** Stairs rising by `height` along `dir`, drawn as solid concrete steps. */
  stairs(x: number, z: number, width: number, length: number, dir: NonNullable<Ramp['dir']>, height: number, mat: string, base = 0) {
    const along = dir[0] as 'x' | 'z', sign = dir[1] === '+' ? 1 : -1;
    const w = along === 'x' ? length : width, d = along === 'z' ? length : width;
    this.nav.ramps.push({ x, z, w, d, height, dir, base });
    const steps = Math.round(height / 0.17);
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps, hh = base + height * t1;
      const c = -length / 2 + (t0 + t1) / 2 * length;
      const sx = along === 'x' ? x + sign * c : x, sz = along === 'z' ? z + sign * c : z;
      const m = this.box(sx, (hh + base) / 2 - 0.0, sz, along === 'x' ? length / steps + 0.002 : width, hh - base, along === 'z' ? length / steps + 0.002 : width, mat, { collide: false, shadow: i % 3 === 0 });
      if (m) m.metadata.solid = true;
    }
  }

  // ------------------------------------------------------------------------------------------ buildings
  private sideFrame(b: BuildingSpec, side: Side) {
    const T = STOREY.wall;
    if (side === 's') return { along: 'x' as const, L: b.w, c: b.x, face: b.z - b.d / 2, inward: 1 };
    if (side === 'n') return { along: 'x' as const, L: b.w, c: b.x, face: b.z + b.d / 2, inward: -1 };
    if (side === 'w') return { along: 'z' as const, L: b.d - 2 * T, c: b.z, face: b.x - b.w / 2, inward: 1 };
    return { along: 'z' as const, L: b.d - 2 * T, c: b.z, face: b.x + b.w / 2, inward: -1 };
  }
  /** One wall piece between u0..u1 (along the side) and y0..y1, outer/inner plaster layers plus collision. */
  private wallPiece(b: BuildingSpec, side: Side, u0: number, u1: number, y0: number, y1: number, outer: string, inner: string) {
    if (u1 - u0 < 0.02 || y1 - y0 < 0.02) return;
    const f = this.sideFrame(b, side), T = STOREY.wall, mid = f.c + (u0 + u1) / 2, len = u1 - u0, y = (y0 + y1) / 2, h = y1 - y0;
    const at = (depth: number) => f.face + f.inward * depth;
    const made = f.along === 'x'
      ? [this.box(mid, y, at(0.1), len, h, 0.2, outer, { collide: false }), this.box(mid, y, at(0.25), len, h, 0.1, inner, { collide: false, shadow: false })]
      : [this.box(at(0.1), y, mid, 0.2, h, len, outer, { collide: false }), this.box(at(0.25), y, mid, 0.1, h, len, inner, { collide: false, shadow: false })];
    if (f.along === 'x') this.collider(mid, at(T / 2), len, T, y0, y1); else this.collider(at(T / 2), mid, T, len, y0, y1);
    for (const m of made) if (m) m.metadata.solid = true;
  }
  /** Point on the outside face of a wall, `out` metres proud of it. */
  private facePoint(b: BuildingSpec, side: Side, u: number, y: number, out = 0.02) {
    const f = this.sideFrame(b, side);
    return f.along === 'x' ? new Vector3(f.c + u, y, f.face - f.inward * out) : new Vector3(f.face - f.inward * out, y, f.c + u);
  }
  private corner(b: BuildingSpec, side: Side, u: number) {
    // which building corner (if any) a position along a side approaches
    const f = this.sideFrame(b, side), near = u > 0 ? 1 : -1;
    if (Math.abs(u) < f.L / 2 - 4.6) return null;
    if (side === 's' || side === 'n') return `${side}${near > 0 ? 'e' : 'w'}`;
    return `${near > 0 ? 'n' : 's'}${side}`;
  }
  building(b: BuildingSpec) {
    const T = STOREY.wall, { f1, gf, roofBase, roofTop } = STOREY;
    const outer0 = b.wall, outer1 = b.upperWall ?? b.wall, inner = b.inner ?? 'whitePlaster@#d9d0c0!in';
    const trim = b.trim ?? 'dirtyConcrete';
    const openings: Opening[] = [];
    const add = (side: Side, at: number, width: number, bottom: number, top: number, floor: 0 | 1, kind: Opening['kind']) =>
      openings.push({ side, u0: at - width / 2, u1: at + width / 2, bottom, top, floor, kind });
    for (const [side, at] of b.doors) add(side, at, STOREY.door, 0, 2.35, 0, 'door');
    for (const [side, at, width] of b.shops ?? []) add(side, at, width, 0, 2.75, 0, 'shop');
    for (const [side, at] of b.balcony ?? []) add(side, at, STOREY.door, f1, f1 + 2.35, 1, 'door');
    for (const [side, at] of b.bridgeDoors ?? []) add(side, at, STOREY.door, f1, f1 + 2.35, 1, 'door');
    for (const [side, at, floor] of b.damage?.holes ?? []) add(side, at, floor ? 2 : 1.7, floor ? f1 + 0.35 : 0.55, floor ? f1 + 2.3 : 2.3, floor, 'hole');
    // stairs
    const st = b.stairs; let hole: { x0: number; x1: number; z0: number; z1: number } | null = null;
    const SL = STOREY.stairLen, SW = STOREY.stairW;
    if (st.kind === 'inner') {
      const off = (st.at ?? 0);
      if (st.side === 'w' || st.side === 'e') {
        const sx = st.side === 'w' ? b.x - b.w / 2 + T + SW / 2 : b.x + b.w / 2 - T - SW / 2;
        const z0 = b.z - b.d / 2 + T + 0.3 + off;
        this.stairs(sx, z0 + SL / 2, SW, SL, 'z+', f1, 'dirtyConcrete');
        hole = { x0: sx - SW / 2, x1: sx + SW / 2, z0, z1: z0 + SL };
        this.box(sx + (st.side === 'w' ? SW / 2 + 0.05 : -SW / 2 - 0.05), f1 + 0.5, z0 + SL / 2 - 0.5, 0.08, 1.0, SL - 1, 'rustyMetal');
      } else {
        const sz = st.side === 's' ? b.z - b.d / 2 + T + SW / 2 : b.z + b.d / 2 - T - SW / 2;
        const x0 = b.x - b.w / 2 + T + 0.3 + off;
        this.stairs(x0 + SL / 2, sz, SW, SL, 'x+', f1, 'dirtyConcrete');
        hole = { x0, x1: x0 + SL, z0: sz - SW / 2, z1: sz + SW / 2 };
        this.box(x0 + SL / 2 - 0.5, f1 + 0.5, sz + (st.side === 's' ? SW / 2 + 0.05 : -SW / 2 - 0.05), SL - 1, 1.0, 0.08, 'rustyMetal');
      }
    } else {
      const at = st.at ?? 0;
      add(st.side, at, STOREY.door, f1, f1 + 2.35, 1, 'door');
      const f = this.sideFrame(b, st.side), out = SW / 2 + 0.05;
      const lp = f.along === 'x' ? { x: f.c + at, z: f.face - f.inward * out } : { x: f.face - f.inward * out, z: f.c + at };
      // landing outside the upper door, stairs running back along the wall
      this.slab(lp.x, lp.z, f.along === 'x' ? 1.8 : SW, f.along === 'x' ? SW : 1.8, f1, 0.3, 'dirtyConcrete');
      if (f.along === 'x') this.stairs(lp.x - 0.9 - SL / 2, lp.z, SW, SL, 'x+', f1, 'dirtyConcrete');
      else this.stairs(lp.x, lp.z - 0.9 - SL / 2, SW, SL, 'z+', f1, 'dirtyConcrete');
      // railing on the open edge of the landing
      if (f.along === 'x') this.box(lp.x + 0.9, f1 + 0.5, lp.z, 0.06, 1, SW, 'rustyMetal', { collide: true });
      else this.box(lp.x, f1 + 0.5, lp.z + 0.9, SW, 1, 0.06, 'rustyMetal', { collide: true });
    }
    for (const o of openings) {
      if (o.floor !== 0 || (o.kind !== 'door' && o.kind !== 'shop')) continue;
      if (o.kind === 'shop' && (b.shops ?? []).find(s => s[0] === o.side && Math.abs(s[1] - (o.u0 + o.u1) / 2) < 0.01)?.[3] === 'closed') continue;
      const f = this.sideFrame(b, o.side), a = f.c + o.u0 - 0.3, c = f.c + o.u1 + 0.3;
      const out = f.face - f.inward * 2.0, inn = f.face + f.inward * 1.4;
      this.doorZones.push(f.along === 'x'
        ? { x0: a, x1: c, z0: Math.min(out, inn), z1: Math.max(out, inn) }
        : { x0: Math.min(out, inn), x1: Math.max(out, inn), z0: a, z1: c });
    }
    // automatic windows
    const spacing = b.windows ?? 3.2;
    const collapse = b.damage?.corner;
    if (spacing > 0) for (const side of ['n', 's', 'e', 'w'] as Side[]) {
      const L = this.sideFrame(b, side).L;
      for (const floor of [0, 1] as const) for (let u = -L / 2 + 1.6; u <= L / 2 - 1.6; u += spacing) {
        const w = floor ? 1.3 : 1.2, u0 = u - w / 2, u1 = u + w / 2;
        if (openings.some(o => o.side === side && o.floor === floor && o.u0 < u1 + 0.6 && o.u1 > u0 - 0.6)) continue;
        if (floor === 0 && st.kind === 'inner' && st.side === side) continue;
        if (this.rand() < 0.12) continue;
        add(side, u, w, floor ? f1 + 0.95 : 1.0, floor ? f1 + 2.25 : 2.2, floor, 'window');
      }
    }
    // walls with openings; an optional ruined corner on the upper floor
    const jag = new Map<string, number>();
    const cap = (side: Side, u: number, floor: 0 | 1, top: number) => {
      if (b.damage?.roofless && floor === 1) {
        const k = `${side}${Math.floor(u / 0.7)}`; if (!jag.has(k)) jag.set(k, f1 + this.range(0.6, 2.6)); return Math.min(top, jag.get(k)!);
      }
      if (!collapse || floor === 0) return top;
      const c = this.corner(b, side, u); if (c !== collapse) return top;
      const k = `${side}${Math.floor(u / 0.6)}`; if (!jag.has(k)) jag.set(k, f1 + this.range(0.1, 1.7)); return Math.min(top, jag.get(k)!);
    };
    for (const side of ['n', 's', 'e', 'w'] as Side[]) {
      const L = this.sideFrame(b, side).L;
      for (const floor of [0, 1] as const) {
        const y0 = floor ? f1 : 0, y1 = floor ? roofBase : gf, outer = floor ? outer1 : outer0;
        const piece = (u0: number, u1: number, ya: number, yb: number) => {
          // subdivide where the top is jagged
          const slices = (collapse || b.damage?.roofless) && floor === 1 ? Math.max(1, Math.ceil((u1 - u0) / 0.6)) : 1;
          for (let i = 0; i < slices; i++) {
            const a = u0 + (u1 - u0) * i / slices, c = u0 + (u1 - u0) * (i + 1) / slices;
            const top = Math.min(yb, cap(side, (a + c) / 2, floor, yb));
            if (top > ya + 0.05) this.wallPiece(b, side, a, c, ya, top, outer, inner);
          }
        };
        const list = openings.filter(o => o.side === side && o.floor === floor).sort((p, q) => p.u0 - q.u0);
        let cur = -L / 2;
        for (const o of list) {
          const u0 = Math.max(cur, o.u0), u1 = Math.min(L / 2, o.u1);
          if (u0 > cur + 0.01) piece(cur, u0, y0, y1);
          if (o.bottom > y0 + 0.01) piece(u0, u1, y0, o.bottom);
          if (o.top < y1 - 0.01) piece(u0, u1, o.top, y1);
          cur = Math.max(cur, u1);
          this.openingDetail(b, o, outer);
        }
        if (cur < L / 2 - 0.01) piece(cur, L / 2, y0, y1);
      }
    }
    // floors, ceiling slab and roof
    const ix0 = b.x - b.w / 2 + T, ix1 = b.x + b.w / 2 - T, iz0 = b.z - b.d / 2 + T, iz1 = b.z + b.d / 2 - T;
    this.ground(ix0, iz0, ix1, iz1, b.floor ?? 'wornTiles!in', 0.02);
    const rects = (x0: number, x1: number, z0: number, z1: number, cut: { x0: number; x1: number; z0: number; z1: number } | null) => {
      if (!cut) return [{ x0, x1, z0, z1 }];
      const out = [{ x0, x1: cut.x0, z0, z1 }, { x0: cut.x1, x1, z0, z1 }, { x0: cut.x0, x1: cut.x1, z0, z1: cut.z0 }, { x0: cut.x0, x1: cut.x1, z0: cut.z1, z1 }];
      return out.filter(r => r.x1 - r.x0 > 0.05 && r.z1 - r.z0 > 0.05);
    };
    // structural slab runs under the walls so upper doorways have a floor; tiles only inside
    for (const r of rects(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, hole)) this.slab((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, r.z1 - r.z0, f1, 0.35, 'dirtyConcrete!in');
    for (const r of rects(ix0, ix1, iz0, iz1, hole)) this.ground(r.x0, r.z0, r.x1, r.z1, b.upperFloor ?? 'terrazzo!in', f1 + 0.012);
    // concrete band at slab level all round
    const band = (y: number, h: number, p: number) => {
      this.box(b.x, y, b.z - b.d / 2 - p / 2, b.w + 2 * p, h, p, trim, { collide: false, shadow: false });
      this.box(b.x, y, b.z + b.d / 2 + p / 2, b.w + 2 * p, h, p, trim, { collide: false, shadow: false });
      this.box(b.x - b.w / 2 - p / 2, y, b.z, p, h, b.d, trim, { collide: false, shadow: false });
      this.box(b.x + b.w / 2 + p / 2, y, b.z, p, h, b.d, trim, { collide: false, shadow: false });
    };
    band(gf + 0.17, 0.36, 0.06);
    // corner pilasters give the facades depth
    const top = b.damage?.roofless ? f1 + 0.6 : roofTop;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (collapse && `${sz > 0 ? 'n' : 's'}${sx > 0 ? 'e' : 'w'}` === collapse) continue;
      this.box(b.x + sx * (b.w / 2 + 0.02), top / 2, b.z + sz * (b.d / 2 + 0.02), 0.5, top, 0.5, trim, { collide: false, shadow: false });
    }
    if (!b.damage?.roofless) {
      let roofCut: { x0: number; x1: number; z0: number; z1: number } | null = null;
      if (collapse) {
        const east = collapse.includes('e'), north = collapse.includes('n');
        roofCut = { x0: east ? b.x + b.w / 2 - 4.8 : b.x - b.w / 2 - 0.2, x1: east ? b.x + b.w / 2 + 0.2 : b.x - b.w / 2 + 4.8, z0: north ? b.z + b.d / 2 - 4.8 : b.z - b.d / 2 - 0.2, z1: north ? b.z + b.d / 2 + 0.2 : b.z - b.d / 2 + 4.8 };
      }
      for (const r of rects(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, roofCut)) {
        this.box((r.x0 + r.x1) / 2, (roofBase + roofTop) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, roofTop - roofBase, r.z1 - r.z0, 'dirtyConcrete!in');
      }
      // parapet
      const par = (x: number, z: number, w: number, d: number) => {
        if (roofCut && x + w / 2 > roofCut.x0 && x - w / 2 < roofCut.x1 && z + d / 2 > roofCut.z0 && z - d / 2 < roofCut.z1) return;
        this.box(x, roofTop + 0.35, z, w, 0.7, d, outer1);
      };
      for (let u = -b.w / 2; u < b.w / 2 - 0.01; u += 3) { const len = Math.min(3, b.w / 2 - u); par(b.x + u + len / 2, b.z - b.d / 2 + 0.12, len, 0.24); par(b.x + u + len / 2, b.z + b.d / 2 - 0.12, len, 0.24); }
      for (let u = -b.d / 2 + 0.24; u < b.d / 2 - 0.25; u += 3) { const len = Math.min(3, b.d / 2 - 0.24 - u); par(b.x - b.w / 2 + 0.12, b.z + u + len / 2, 0.24, len); par(b.x + b.w / 2 - 0.12, b.z + u + len / 2, 0.24, len); }
      if (b.roofDetail !== false) this.roofDetail(b, roofCut);
      if (roofCut) this.collapseDebris(b, collapse!);
    } else {
      this.mound(b.x + this.range(-1, 1), b.z + this.range(-1, 1), Math.min(b.w, b.d) * 0.22, 0.9, 'rubble');
    }
    // partition with door on both floors
    if (b.partition) {
      const p = b.partition;
      for (const floor of [0, 1]) {
        const y0 = floor ? f1 : 0, y1 = floor ? roofBase : gf, yc = (y0 + y1) / 2, h = y1 - y0;
        if (p.axis === 'x') {
          const z = b.z + p.at, a0 = ix0, a1 = ix1, d0 = b.x + p.door - 1, d1 = b.x + p.door + 1;
          for (const [s, e] of [[a0, d0], [d1, a1]]) if (e - s > 0.1) {
            if (floor && hole && hole.x0 < e && hole.x1 > s && hole.z0 < z && hole.z1 > z) continue;
            this.box((s + e) / 2, yc, z, e - s, h, 0.18, inner);
          }
          this.box(b.x + p.door, y1 - 0.4, z, 2, 0.8, 0.18, inner);
        } else {
          const x = b.x + p.at, a0 = iz0, a1 = iz1, d0 = b.z + p.door - 1, d1 = b.z + p.door + 1;
          for (const [s, e] of [[a0, d0], [d1, a1]]) if (e - s > 0.1) {
            if (floor && hole && hole.z0 < e && hole.z1 > s && hole.x0 < x && hole.x1 > x) continue;
            this.box(x, yc, (s + e) / 2, 0.18, h, e - s, inner);
          }
          this.box(x, y1 - 0.4, b.z + p.door, 0.18, 0.8, 2, inner);
        }
      }
    }
    for (const [side, at] of b.balcony ?? []) this.balcony(b, side, at);
    this.facadeDetail(b, openings);
    // spawn candidates on both floors; finishSpawns() keeps the ones left in clear space
    const pts: Point[] = [];
    for (const [fx, fz] of [[0.18, 0.15], [-0.2, -0.18], [0.2, -0.2], [-0.18, 0.2], [0, 0]]) {
      pts.push({ x: b.x + b.w * fx, z: b.z + b.d * fz, y: f1 }, { x: b.x - b.w * fx, z: b.z - b.d * fz });
    }
    this.spawnGroups.push({ n: b.spawns ?? 2, pts });
  }
  /** Resolve per-building spawn candidates against the finished collision data. */
  finishSpawns() {
    for (const g of this.spawnGroups) {
      const ok = g.pts.filter(p => this.nav.clear(p.x, p.z, p.y ?? this.nav.ground(p.x, p.z)) && Math.abs(this.nav.ground(p.x, p.z, (p.y ?? 0) + 0.1) - (p.y ?? 0)) < 0.3);
      const upper = ok.filter(p => p.y), lower = ok.filter(p => !p.y);
      const chosen: Point[] = [];
      for (let i = 0; chosen.length < g.n && i < ok.length; i++) { const p = i % 2 === 0 ? upper.shift() ?? lower.shift() : lower.shift() ?? upper.shift(); if (p) chosen.push(p); }
      this.enemySpawns.push(...chosen);
    }
    this.spawnGroups = [];
    this.enemySpawns = this.enemySpawns.filter(p => this.nav.clear(p.x, p.z, p.y ?? this.nav.ground(p.x, p.z)));
  }
  private openingDetail(b: BuildingSpec, o: Opening, wallMat: string) {
    const u = (o.u0 + o.u1) / 2, w = o.u1 - o.u0;
    if (o.kind === 'window') {
      // stone sill and frame recess; occasional broken shutter
      const p = this.facePoint(b, o.side, u, o.bottom - 0.05, 0.06);
      const along = this.sideFrame(b, o.side).along;
      this.box(p.x, p.y, p.z, along === 'x' ? w + 0.2 : 0.14, 0.1, along === 'x' ? 0.14 : w + 0.2, 'dirtyConcrete', { collide: false, shadow: false });
      if (this.rand() < 0.28) {
        const q = this.facePoint(b, o.side, o.u0 - 0.32, (o.bottom + o.top) / 2, 0.08);
        this.box(q.x, q.y, q.z, along === 'x' ? 0.6 : 0.04, o.top - o.bottom, along === 'x' ? 0.04 : 0.6, this.pick(['planks', 'greenMetal', 'paintedShutter']), { collide: false, rotY: this.range(-0.25, 0.25) });
      }
      if (this.rand() < 0.22) this.decal('scorch_decal.png', this.facePoint(b, o.side, u, o.top + 0.6, 0.025), o.side, w + 1.6, 2.2);
    } else if (o.kind === 'door') {
      // concrete frame so doorways read clearly from a distance
      const along = this.sideFrame(b, o.side).along, h = o.top - o.bottom;
      for (const e of [o.u0 - 0.08, o.u1 + 0.08]) {
        const p = this.facePoint(b, o.side, e, o.bottom + h / 2, 0.03);
        this.box(p.x, p.y, p.z, along === 'x' ? 0.16 : 0.08, h, along === 'x' ? 0.08 : 0.16, 'dirtyConcrete', { collide: false, shadow: false });
      }
      const l = this.facePoint(b, o.side, u, o.top + 0.08, 0.03);
      this.box(l.x, l.y, l.z, along === 'x' ? w + 0.32 : 0.08, 0.16, along === 'x' ? 0.08 : w + 0.32, 'dirtyConcrete', { collide: false, shadow: false });
    } else if (o.kind === 'hole') {
      const p = this.facePoint(b, o.side, u, (o.bottom + o.top) / 2, 0.026);
      this.decal('scorch_decal.png', p, o.side, w + 2.4, o.top - o.bottom + 2.2);
      // broken masonry around the edges and spilled outside
      const along = this.sideFrame(b, o.side).along;
      for (let i = 0; i < 9; i++) {
        const q = this.facePoint(b, o.side, this.range(o.u0 - 0.2, o.u1 + 0.2), this.pick([o.bottom, o.top]) + this.range(-0.12, 0.12), this.range(-0.1, 0.15));
        this.box(q.x, q.y, q.z, this.range(0.15, 0.45), this.range(0.1, 0.25), this.range(0.15, 0.4), wallMat, { collide: false, rotY: this.range(0, 3), rotX: this.range(-0.4, 0.4), shadow: false });
      }
      const g = this.facePoint(b, o.side, u, 0, 0.9);
      if (o.floor === 1 || o.bottom < 0.8) this.rubble(g.x, g.z, 1.2, 10, along);
    } else if (o.kind === 'shop') {
      const state = (b.shops ?? []).find(s => s[0] === o.side && Math.abs(s[1] - u) < 0.01)?.[3] ?? 'open';
      const p = this.facePoint(b, o.side, u, 0, 0.12);
      const rot = { s: 0, n: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[o.side];
      if (state !== 'open') {
        // a half-open shutter is rolled up above head height, so it never blocks the way in
        const sy = state === 'half' ? 0.27 : 1;
        const root = this.prop('shutterDoor', p.x, p.z, rot, { y: state === 'half' ? 2.75 - 2.4 * sy : 0, collide: false, scale: new Vector3(w / 3.08, sy, 1) });
        if (root) root.getChildMeshes().forEach(m => (m.metadata = { ...(m.metadata ?? {}), solid: true, surface: 'metal' }));
        const f = this.sideFrame(b, o.side);
        const cx = f.along === 'x' ? f.c + u : f.face + f.inward * 0.15, cz = f.along === 'x' ? f.face + f.inward * 0.15 : f.c + u;
        this.collider(cx, cz, f.along === 'x' ? w : 0.3, f.along === 'x' ? 0.3 : w, state === 'half' ? 2.75 - 2.4 * sy : 0, 2.75);
      }
      // roll box above every shopfront
      const rb = this.facePoint(b, o.side, u, 2.62, 0.16);
      const along = this.sideFrame(b, o.side).along;
      this.box(rb.x, rb.y, rb.z, along === 'x' ? w + 0.2 : 0.3, 0.3, along === 'x' ? 0.3 : w + 0.2, 'rustShutter', { collide: false });
      if (b.sign) this.sign(b, o.side, u, Math.min(w + 0.6, 4.2));
    }
  }
  private balcony(b: BuildingSpec, side: Side, at: number) {
    const f = this.sideFrame(b, side), f1 = STOREY.f1, out = 0.7;
    const c = f.along === 'x' ? { x: f.c + at, z: f.face - f.inward * out } : { x: f.face - f.inward * out, z: f.c + at };
    const W = 3.4, D = 1.4;
    const w = f.along === 'x' ? W : D, d = f.along === 'x' ? D : W;
    this.slab(c.x, c.z, w, d, f1, 0.22, 'dirtyConcrete', 'dirtyTiles');
    // railings (block walking off, not shooting)
    const rail = 'rustyMetal';
    const edge = f.along === 'x' ? { x: c.x, z: c.z - f.inward * (D / 2 - 0.04) } : { x: c.x - f.inward * (D / 2 - 0.04), z: c.z };
    this.box(edge.x, f1 + 1.0, edge.z, f.along === 'x' ? W : 0.06, 0.06, f.along === 'x' ? 0.06 : W, rail, { collide: false });
    this.collider(edge.x, edge.z, f.along === 'x' ? W : 0.1, f.along === 'x' ? 0.1 : W, f1, f1 + 1.02);
    for (let i = 0; i <= 10; i++) {
      const t = -W / 2 + i * W / 10;
      this.box(f.along === 'x' ? c.x + t : edge.x, f1 + 0.5, f.along === 'x' ? edge.z : c.z + t, 0.03, 1, 0.03, rail, { collide: false, shadow: false });
    }
    for (const s of [-1, 1]) {
      const sx = f.along === 'x' ? c.x + s * (W / 2 - 0.03) : c.x, sz = f.along === 'x' ? c.z : c.z + s * (W / 2 - 0.03);
      this.box(sx, f1 + 1, sz, f.along === 'x' ? 0.05 : D, 0.05, f.along === 'x' ? D : 0.05, rail, { collide: false, shadow: false });
      this.collider(sx, sz, f.along === 'x' ? 0.1 : D, f.along === 'x' ? D : 0.1, f1, f1 + 1.02);
    }
  }
  private roofDetail(b: BuildingSpec, cut: { x0: number; x1: number; z0: number; z1: number } | null) {
    const top = STOREY.roofTop;
    const free = (x: number, z: number) => !cut || !(x > cut.x0 - 1 && x < cut.x1 + 1 && z > cut.z0 - 1 && z < cut.z1 + 1);
    const count = 1 + Math.floor(this.rand() * 3);
    for (let i = 0; i < count; i++) {
      const x = b.x + this.range(-b.w / 2 + 1.5, b.w / 2 - 1.5), z = b.z + this.range(-b.d / 2 + 1.5, b.d / 2 - 1.5);
      if (!free(x, z)) continue;
      const kind = this.rand();
      if (kind < 0.45) {
        // black plastic water tank on a steel stand
        this.box(x, top + 0.25, z, 1.1, 0.5, 1.1, 'rustyMetal', { collide: false, shadow: false });
        this.cylinder(x, top + 1.05, z, 1.05, 1.1, 'flat:tank:#1c1d1e:.55:0', { shadow: true });
      } else if (kind < 0.8) {
        // solar water heater: tilted collector and a horizontal tank
        this.box(x, top + 0.55, z, 1.0, 0.06, 1.9, 'flat:solar:#24303a:.25:.4', { collide: false, rotX: -0.6 });
        this.cylinder(x, top + 1.15, z + 0.7, 0.45, 1.25, 'flat:boiler:#c9c6bc:.45:.2', { axis: 'x' });
      } else {
        // satellite dish
        this.box(x, top + 0.6, z, 0.06, 1.2, 0.06, 'rustyMetal', { collide: false, shadow: false });
        this.cylinder(x, top + 1.2, z - 0.1, 0.8, 0.06, 'flat:dish:#9d9a92:.6:.2', { axis: 'z' });
      }
    }
  }
  private collapseDebris(b: BuildingSpec, corner: string) {
    const east = corner.includes('e'), north = corner.includes('n');
    const cx = b.x + (east ? b.w / 2 + 1.6 : -b.w / 2 - 1.6), cz = b.z + (north ? b.d / 2 + 1.6 : -b.d / 2 - 1.6);
    this.mound(cx, cz, 2.6, 1.2, 'rubble');
    // fallen slab pieces leaning against the wall and exposed reinforcement
    for (let i = 0; i < 3; i++) this.box(cx + this.range(-1.5, 1.5), 0.6, cz + this.range(-1.5, 1.5), this.range(1.6, 2.6), 0.25, this.range(1.2, 2), 'dirtyConcrete', { collide: false, rotX: this.range(-0.5, 0.5), rotY: this.range(0, 3), rotZ: this.range(-0.4, 0.4) });
    const rx = b.x + (east ? b.w / 2 - 4.8 : -b.w / 2 + 4.8), rz = b.z + (north ? b.d / 2 - 4.8 : -b.d / 2 + 4.8);
    for (let i = 0; i < 9; i++) {
      const alongX = i % 2 === 0;
      this.box(alongX ? rx + this.range(-0.3, 0.3) : b.x + this.range(-b.w / 2, b.w / 2) * 0.2 + (east ? 3 : -3), STOREY.roofBase + 0.1, alongX ? b.z + (north ? 2.5 : -2.5) + this.range(-1, 1) : rz, alongX ? 0.03 : 1.2, 0.03, alongX ? 1.2 : 0.03, 'rustyMetal', { collide: false, shadow: false, rotX: this.range(-0.5, 0.2) });
    }
  }
  private facadeDetail(b: BuildingSpec, openings: Opening[]) {
    if (!this.scene) return;
    for (const side of ['n', 's', 'e', 'w'] as Side[]) {
      const L = this.sideFrame(b, side).L;
      // grime at the base and below the parapet
      this.decal('grime', this.facePoint(b, side, 0, 0.8, 0.023), side, L, 1.6);
      if (!b.damage?.roofless) this.decal('grime-top', this.facePoint(b, side, 0, STOREY.roofBase - 0.9, 0.023), side, L, 1.9);
      // bullet strikes in clusters
      const clusters = 1 + Math.floor(this.rand() * 3);
      for (let c = 0; c < clusters; c++) {
        const cu = this.range(-L / 2 + 1, L / 2 - 1), cy = this.range(0.8, 5.8);
        for (let i = 0; i < 9; i++) {
          const s = this.range(0.06, 0.13);
          this.decal('bullet_hole.png', this.facePoint(b, side, cu + this.range(-0.9, 0.9), cy + this.range(-0.7, 0.7), 0.028), side, s, s, this.range(0, 6));
        }
      }
      // air conditioner units beside some windows
      const win = openings.filter(o => o.side === side && o.kind === 'window');
      if (win.length && this.rand() < 0.5) {
        const o = this.pick(win), p = this.facePoint(b, side, o.u1 + 0.6, o.top + 0.2, 0.2), along = this.sideFrame(b, side).along;
        this.box(p.x, p.y, p.z, along === 'x' ? 0.8 : 0.32, 0.55, along === 'x' ? 0.32 : 0.8, 'flat:ac:#8c887e:.7:.1', { collide: false, shadow: true });
      }
    }
    if (b.damage?.burnt) for (const o of openings) if (o.kind !== 'hole' && this.rand() < 0.5) {
      this.decal('scorch_decal.png', this.facePoint(b, o.side, (o.u0 + o.u1) / 2, o.top + 0.7, 0.027), o.side, o.u1 - o.u0 + 1.4, 2.4);
    }
  }
  sign(b: BuildingSpec, side: Side, u: number, width: number) {
    if (!this.scene || !b.sign) return;
    const p = this.facePoint(b, side, u, 3.05, 0.09);
    const tex = new DynamicTexture(`sign-${this.signCount++}`, { width: 512, height: 112 }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const bg = this.pick(['#2e4840', '#5a2f26', '#3a3d4a', '#6b5a2a', '#2c3f57']);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 112);
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(${this.rand() < 0.5 ? '20,15,10' : '200,190,170'},${this.range(0.03, 0.14)})`; ctx.fillRect(this.rand() * 512, this.rand() * 112, this.range(1, 9), this.range(1, 3)); }
    ctx.fillStyle = '#e2d6bb'; ctx.font = 'bold 54px Arial'; const t = b.sign.toUpperCase();
    ctx.fillText(t, (512 - ctx.measureText(t).width) / 2, 76);
    ctx.fillStyle = 'rgba(30,22,15,.35)'; for (let i = 0; i < 6; i++) ctx.fillRect(this.rand() * 512, this.rand() * 112, this.range(10, 60), this.range(4, 20));
    tex.update();
    const m = new PBRMaterial('sign-mat', this.scene); m.albedoTexture = tex; m.roughness = 0.75; m.metallic = 0.1;
    const plane = MeshBuilder.CreatePlane('shop-sign', { width, height: 0.62 }, this.scene);
    plane.position.copyFrom(p); plane.rotation.y = { s: 0, n: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[side]; plane.rotation.z = this.range(-0.04, 0.04);
    plane.material = m; plane.isPickable = false;
  }

  // ------------------------------------------------------------------------------------------ props & clutter
  /** Place a GLB model. Collision uses PROP_INFO so layouts work without models. */
  prop(name: ModelName, x: number, z: number, rotY = 0, o: { y?: number; collide?: boolean; scale?: Vector3; pick?: boolean; dynamic?: boolean } = {}) {
    const info = PROP_INFO[name];
    if (info && (o.collide ?? true) && (o.y ?? 0) < 0.5 && this.blocksDoor(x, z, Math.max(info.w, info.d) * (o.scale?.x ?? 1), Math.max(info.w, info.d) * (o.scale?.z ?? 1))) return null;
    if (info && (o.collide ?? true)) {
      const sx = o.scale?.x ?? 1, sz = o.scale?.z ?? 1, sy = o.scale?.y ?? 1;
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const w = info.w * sx, d = info.d * sz;
      this.collider(x, z, w * c + d * s, w * s + d * c, o.y ?? 0, (o.y ?? 0) + info.h * sy);
    }
    const container = this.models?.[name];
    if (!this.scene || !container) return null;
    const inst = container.instantiateModelsToScene(n => `${name}-${n}`, false, { doNotInstantiate: true });
    const root = inst.rootNodes[0] as TransformNode;
    root.setEnabled(true);
    const holder = new TransformNode(`${name}-prop`, this.scene);
    root.parent = holder;
    holder.position.set(x, o.y ?? 0, z); holder.rotation.y = rotY;
    if (o.scale) holder.scaling.copyFrom(o.scale);
    holder.computeWorldMatrix(true);
    // sit the model on its base
    const { min } = holder.getHierarchyBoundingVectors(true);
    root.position.y -= (min.y - (o.y ?? 0)) / (o.scale?.y ?? 1);
    for (const m of holder.getChildMeshes()) {
      m.receiveShadows = true; m.isPickable = o.pick ?? true;
      m.metadata = { solid: o.collide ?? true, surface: info?.surface ?? 'metal', static: !o.dynamic };
      if (!o.dynamic && m instanceof Mesh) this.staticMeshes.push(m);
      this.env?.caster(m);
    }
    if (o.dynamic) this.dynamicRoots.push(holder);
    return holder;
  }
  car(name: 'sedanBurnt' | 'hatchRust' | 'pickupBurnt' | 'carBroken', x: number, z: number, rotY: number, burning = false) {
    this.prop(name, x, z, rotY);
    if (name.includes('Burnt')) this.decal('scorch_decal.png', new Vector3(x, 0.03, z), 'y', 5.5, 6.5, rotY);
    if (burning) this.firePoints.push({ at: new Vector3(x, 0.5, z), scale: 1, light: true });
  }
  /** Low sandbag wall built from stacked sacks. */
  sandbags(x: number, z: number, length: number, alongX: boolean, rows = 6, base = 0) {
    const h = rows * 0.165 + 0.05;
    if (base < 0.5 && this.blocksDoor(x, z, alongX ? length : 0.75, alongX ? 0.75 : length)) return;
    this.collider(x, z, alongX ? length : 0.75, alongX ? 0.75 : length, base, base + h);
    if (!this.scene) return;
    const per = Math.max(1, Math.round(length / 0.62));
    for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) {
      const t = -length / 2 + (i + 0.5 + (r % 2) * 0.5) * (length / per);
      if (t > length / 2 - 0.1) continue;
      const jitter = this.range(-0.04, 0.04);
      this.sack(alongX ? x + t : x + jitter, base + 0.085 + r * 0.165, alongX ? z + jitter : z + t, (alongX ? 0 : Math.PI / 2) + this.range(-0.1, 0.1));
    }
  }
  private sackTemplate?: Mesh;
  /** Hessian sandbag: a squashed sphere, merged with the static batch. */
  private sack(x: number, y: number, z: number, rotY: number) {
    if (!this.sackTemplate) {
      this.sackTemplate = MeshBuilder.CreateSphere('sandbag', { segments: 6, diameter: 1 }, this.scene!);
      this.sackTemplate.material = this.material('hessian@#cdbd98'); this.sackTemplate.setEnabled(false);
    }
    const m = this.sackTemplate.clone('sandbag', null)!;
    m.setEnabled(true); m.position.set(x, y, z); m.rotation.set(this.range(-0.05, 0.05), rotY, this.range(-0.06, 0.06));
    m.scaling.set(this.range(0.6, 0.66), 0.19, 0.36); m.receiveShadows = true;
    m.metadata = { solid: true, surface: 'fabric', static: true };
    this.env?.caster(m); this.staticMeshes.push(m);
  }
  barrier(x: number, z: number, rotY = 0) { this.prop('jersey', x, z, rotY); }
  /** Tall precast T-wall segment. */
  tWall(x: number, z: number, alongX: boolean) {
    this.box(x, 1.65, z, alongX ? 1.5 : 0.32, 3.3, alongX ? 0.32 : 1.5, 'panelConcrete');
    this.box(x, 0.2, z, alongX ? 1.5 : 1.1, 0.4, alongX ? 1.1 : 1.5, 'panelConcrete', { collide: false });
  }
  hedgehog(x: number, z: number) {
    if (this.blocksDoor(x, z, 1.9, 1.9)) return;
    this.collider(x, z, 1.4, 1.4, 0, 1.0);
    for (let i = 0; i < 3; i++) this.box(x, 0.6, z, 1.9, 0.14, 0.14, 'flat:steel:#3a3632:.55:.75', { collide: false, rotY: i * Math.PI / 3, rotZ: i === 0 ? 0.55 : i === 1 ? -0.55 : 0, rotX: i === 2 ? 0.6 : 0 });
  }
  /** Loose broken masonry, purely visual. */
  rubble(x: number, z: number, radius: number, count: number, _along?: 'x' | 'z') {
    if (!this.scene) return;
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2, r = Math.sqrt(this.rand()) * radius, s = this.range(0.12, 0.45);
      this.box(x + Math.cos(a) * r, s * 0.25, z + Math.sin(a) * r, s, s * this.range(0.4, 0.9), s * this.range(0.6, 1.2), this.rand() < 0.75 ? 'rubble' : 'dirtyConcrete', { collide: false, rotY: this.range(0, 3), rotX: this.range(-0.3, 0.3), shadow: false });
    }
  }
  /** Climbable heap of rubble: stepped collision terraces under scattered blocks. */
  mound(x: number, z: number, radius: number, height: number, mat = 'rubble') {
    if (this.blocksDoor(x, z, radius * 2, radius * 2)) return;
    const steps = Math.max(1, Math.round(height / 0.3));
    for (let i = 0; i < steps; i++) {
      const r = radius * (1 - i / steps), top = height * (i + 1) / steps;
      this.collider(x, z, r * 2, r * 2, 0, top);
      this.box(x, top / 2, z, r * 2 * 0.95, top, r * 2 * 0.95, mat, { collide: false, rotY: this.range(-0.3, 0.3), shadow: i === 0 });
    }
    this.rubble(x, z, radius * 1.15, Math.round(radius * 10));
    for (let i = 0; i < 4; i++) this.box(x + this.range(-radius, radius) * 0.6, height * this.range(0.5, 1), z + this.range(-radius, radius) * 0.6, this.range(0.6, 1.4), 0.2, this.range(0.5, 1.2), 'dirtyConcrete', { collide: false, rotX: this.range(-0.5, 0.5), rotY: this.range(0, 3), rotZ: this.range(-0.5, 0.5), shadow: false });
  }
  crater(x: number, z: number, radius: number) {
    if (this.blocksDoor(x, z, radius * 1.4, radius * 1.4)) return;
    this.decal('scorch_decal.png', new Vector3(x, 0.035, z), 'y', radius * 2.6, radius * 2.6, this.range(0, 6));
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + this.range(-0.2, 0.2), r = radius * this.range(0.85, 1.1);
      this.box(x + Math.cos(a) * r, 0.12, z + Math.sin(a) * r, this.range(0.5, 1), 0.24, this.range(0.4, 0.8), 'rubble', { collide: false, rotY: a, rotX: this.range(-0.2, 0.2), shadow: false });
    }
    this.collider(x, z, radius * 1.4, radius * 1.4, 0, 0.3);
  }
  /** Wooden market stall with a sagging cloth awning. */
  stall(x: number, z: number, rotY: number, cloth: string) {
    if (this.blocksDoor(x, z, 3.0, 3.0)) return;
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const at = (u: number, v: number) => ({ x: x + u * c + v * s, z: z - u * s + v * c });
    for (const [u, v] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) { const p = at(u, v); this.box(p.x, 1.2, p.z, 0.09, 2.4, 0.09, 'wood', { collide: false, shadow: true }); }
    const counter = at(0, -0.55);
    this.box(counter.x, 0.5, counter.z, 2.6 * Math.abs(c) + 0.6 * Math.abs(s), 1.0, 2.6 * Math.abs(s) + 0.6 * Math.abs(c), 'planks', { rotY: 0 });
    if (this.scene) {
      const awning = MeshBuilder.CreateGround('awning', { width: 2.9, height: 2.0, subdivisions: 6 }, this.scene);
      const pos = awning.getVerticesData('position')!;
      for (let i = 0; i < pos.length; i += 3) pos[i + 1] = -0.18 * (1 - Math.pow(pos[i] / 1.45, 2)) * (1 - Math.pow(pos[i + 2] / 1.0, 2)) + this.range(-0.02, 0.02);
      awning.updateVerticesData('position', pos); awning.createNormals(true);
      awning.position.set(x, 2.38, z); awning.rotation.set(-0.12, rotY, 0);
      const m = new PBRMaterial('awning-mat', this.scene); m.albedoColor = Color3.FromHexString(cloth).toLinearSpace(); m.roughness = 0.95; m.backFaceCulling = false;
      m.albedoTexture = this.mats!.get('hessian').albedoTexture;
      awning.material = m; awning.receiveShadows = true; this.env?.caster(awning);
      awning.metadata = { solid: false, static: true }; this.staticMeshes.push(awning);
    }
    for (let i = 0; i < 3; i++) { const p = at(this.range(-1, 1), this.range(-0.2, 0.6)); this.prop(this.pick(['plasticCrate', 'plasticCrate3', 'cardboard'] as ModelName[]), p.x, p.z, this.range(0, 3), { collide: false, y: this.rand() < 0.4 ? 1.0 : 0 }); }
  }
  /** Utility poles with sagging cables between consecutive points. */
  cables(points: [number, number][], height = 7.2) {
    for (const [x, z] of points) this.cylinder(x, height / 2, z, 0.22, height, 'flat:pole:#5b5145:.9:0', { collide: true, tess: 8 });
    if (!this.scene) return;
    for (let i = 0; i < points.length - 1; i++) for (const off of [-0.25, 0, 0.25]) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1], path: Vector3[] = [];
      for (let t = 0; t <= 1.0001; t += 0.1) path.push(new Vector3(ax + (bx - ax) * t, height - 0.3 + off * 0.3 - Math.sin(Math.PI * t) * 0.9, az + (bz - az) * t + off));
      const tube = MeshBuilder.CreateTube('cable', { path, radius: 0.012, tessellation: 4 }, this.scene);
      tube.material = this.mats!.flat('cable', '#141414', 0.7, 0); tube.isPickable = false; tube.metadata = { static: true, solid: false };
      this.staticMeshes.push(tube);
    }
  }
  /** Flat decal (bullet strikes, scorch, grime). `side` is the wall the decal faces out of, or 'y' for the ground. */
  decal(tex: string, p: Vector3, side: Side | 'y', w: number, h: number, rot = 0) {
    if (!this.scene || !this.env) return;
    const plane = MeshBuilder.CreatePlane('decal', { width: w, height: h }, this.scene);
    plane.position.copyFrom(p);
    if (side === 'y') { plane.rotation.x = Math.PI / 2; plane.rotation.y = rot; }
    else { plane.rotation.y = { s: 0, n: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[side]; plane.rotation.z = rot; }
    plane.material = this.decalMaterial(tex); plane.isPickable = false;
    plane.receiveShadows = true;
    this.decals.push({ tex, mesh: plane });
  }
  private decalMaterial(tex: string) {
    let m = this.decalMats.get(tex);
    if (!m) {
      m = new PBRMaterial(`decal-${tex}`, this.scene!);
      const t = tex.startsWith('grime') ? this.grimeTexture(tex === 'grime-top') : this.env!.fx.get(tex);
      m.albedoTexture = t; m.useAlphaFromAlbedoTexture = true; m.albedoTexture.hasAlpha = true;
      m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; m.roughness = 1; m.metallic = 0;
      m.zOffset = -2; m.backFaceCulling = true;
      if (tex === 'bullet_hole.png') m.albedoColor = new Color3(0.85, 0.82, 0.78);
      this.decalMats.set(tex, m);
    }
    return m;
  }
  private grimeTexture(top: boolean) {
    const t = new DynamicTexture(top ? 'grime-top' : 'grime', { width: 256, height: 256 }, this.scene!, true);
    const ctx = t.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 2) {
      const h = 0.45 + 0.55 * Math.abs(Math.sin(x * 0.07) * Math.sin(x * 0.023 + 1.7));
      const g = top ? ctx.createLinearGradient(0, 0, 0, 256 * h) : ctx.createLinearGradient(0, 256, 0, 256 * (1 - h));
      g.addColorStop(0, top ? 'rgba(30,24,18,0.45)' : 'rgba(46,36,24,0.62)'); g.addColorStop(1, 'rgba(46,36,24,0)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 2, 256);
    }
    t.hasAlpha = true; t.update(); t.wrapU = Texture.WRAP_ADDRESSMODE;
    return t;
  }
  /** Merge decals per texture into single draw calls. */
  finishDecals() {
    if (!this.scene) return;
    const groups = new Map<string, Mesh[]>();
    for (const d of this.decals) { const g = groups.get(d.tex) ?? []; g.push(d.mesh); groups.set(d.tex, g); }
    for (const [, meshes] of groups) {
      const merged = meshes.length > 1 ? Mesh.MergeMeshes(meshes, true, true) : meshes[0];
      if (merged) { merged.isPickable = false; merged.receiveShadows = true; merged.freezeWorldMatrix(); merged.metadata = { decal: true }; }
    }
    this.decals = [];
  }
  /** Ruined skyline beyond the boundary: unlit by gameplay, shaded by fog. */
  skyline(walls: string[]) {
    for (let side = 0; side < 4; side++) for (let i = 0; i < 9; i++) {
      const along = -48 + i * 12 + this.range(-2, 2), depth = 41 + this.range(0, 14);
      const w = this.range(7, 13), d = this.range(7, 11), h = this.range(5, 17) * (this.rand() < 0.2 ? 0.5 : 1);
      const [x, z] = side === 0 ? [along, depth] : side === 1 ? [along, -depth] : side === 2 ? [depth, along] : [-depth, along];
      const mat = this.pick(walls);
      const m = this.box(x, h / 2, z, w, h, d, mat, { collide: false, shadow: false });
      if (m) m.isPickable = false;
      if (this.rand() < 0.5) {
        const m2 = this.box(x + this.range(-2, 2), h + 0.8, z + this.range(-2, 2), w * 0.4, 1.6, d * 0.3, mat, { collide: false, shadow: false, rotZ: this.range(-0.3, 0.3) });
        if (m2) m2.isPickable = false;
      }
    }
  }
  /** Perimeter walls keep players inside; mixed heights and materials avoid a box look. */
  boundary(mats: string[], height = 4.8) {
    for (const s of [-1, 1]) for (let i = 0; i < 12; i++) {
      const t = -35 + i * 70 / 12 + 70 / 24, h = height + this.range(-0.8, 1.2), mat = this.pick(mats);
      this.box(s * 35.5, h / 2, t, 1, h, 70 / 12, mat);
      this.box(t, h / 2, s * 35.5, 70 / 12, h, 1, mat);
    }
  }
}
