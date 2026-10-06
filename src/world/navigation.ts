export type Point = { x: number; z: number; y?: number };
export type Collider = { x: number; z: number; w: number; d: number; bottom: number; top: number; active: boolean };
/** A walkable slope. It rises from `base` at the low end to `base + height` at the end named by `dir`. */
export type Ramp = { x: number; z: number; w: number; d: number; height: number; dir?: 'z+' | 'z-' | 'x+' | 'x-'; base?: number };

const CELL = 2;
type Node = { x: number; z: number; y: number; g: number; f: number; key: string };

/** Minimal binary heap keyed on f, used by the A* search. */
class Heap {
  items: Node[] = [];
  get size() { return this.items.length; }
  push(n: Node) {
    const a = this.items; a.push(n);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

export function rampHeight(r: Ramp, x: number, z: number) {
  const dir = r.dir ?? 'z+';
  let t: number;
  if (dir === 'z+') t = (z - (r.z - r.d / 2)) / r.d;
  else if (dir === 'z-') t = ((r.z + r.d / 2) - z) / r.d;
  else if (dir === 'x+') t = (x - (r.x - r.w / 2)) / r.w;
  else t = ((r.x + r.w / 2) - x) / r.w;
  return (r.base ?? 0) + r.height * Math.max(0, Math.min(1, t));
}

export class Navigation {
  colliders: Collider[] = [];
  ramps: Ramp[] = [];
  platforms: Collider[] = [];
  size = 35;
  private grid = new Map<number, Collider[]>();
  private platformGrid = new Map<number, Collider[]>();
  private indexed = -1;
  private indexedPlatforms = -1;
  private stamp = 0;
  private stamps = new WeakMap<Collider, number>();

  private cellKey(cx: number, cz: number) { return (cx + 512) * 1024 + (cz + 512); }
  private bucket(grid: Map<number, Collider[]>, list: Collider[]) {
    grid.clear();
    for (const c of list) {
      const x0 = Math.floor((c.x - c.w / 2) / CELL), x1 = Math.floor((c.x + c.w / 2) / CELL);
      const z0 = Math.floor((c.z - c.d / 2) / CELL), z1 = Math.floor((c.z + c.d / 2) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const k = this.cellKey(cx, cz); let b = grid.get(k);
        if (!b) grid.set(k, b = []); b.push(c);
      }
    }
  }
  private index() {
    if (this.indexed !== this.colliders.length) { this.bucket(this.grid, this.colliders); this.indexed = this.colliders.length; }
    if (this.indexedPlatforms !== this.platforms.length) { this.bucket(this.platformGrid, this.platforms); this.indexedPlatforms = this.platforms.length; }
  }
  /** Colliders whose footprint may touch the square around (x, z). */
  private near(x: number, z: number, radius: number, grid = this.grid) {
    this.index();
    const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL);
    const z0 = Math.floor((z - radius) / CELL), z1 = Math.floor((z + radius) / CELL);
    if (x0 === x1 && z0 === z1) return grid.get(this.cellKey(x0, z0)) ?? [];
    const out: Collider[] = []; const s = ++this.stamp;
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      for (const c of grid.get(this.cellKey(cx, cz)) ?? []) if (this.stamps.get(c) !== s) { this.stamps.set(c, s); out.push(c); }
    }
    return out;
  }

  ground(x: number, z: number, maxY = 0) {
    let y = 0;
    for (const c of this.near(x, z, 0)) if (c.active && c.top <= maxY + .38 && Math.abs(x - c.x) < c.w / 2 && Math.abs(z - c.z) < c.d / 2) y = Math.max(y, c.top);
    for (const p of this.near(x, z, 0, this.platformGrid)) if (p.active && p.top <= maxY + 0.45 && Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2) y = Math.max(y, p.top);
    for (const r of this.ramps) if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) {
      const h = rampHeight(r, x, z); if (h <= maxY + 0.5) y = Math.max(y, h);
    }
    return y;
  }
  clear(x: number, z: number, y = this.ground(x, z), radius = 0.35) {
    if (Math.abs(x) > this.size - radius || Math.abs(z) > this.size - radius) return false;
    for (const r of this.ramps) if (Math.abs(x - r.x) < r.w / 2 && Math.abs(z - r.z) < r.d / 2) {
      if (rampHeight(r, x, z) > y + .5) return false;
    }
    for (const c of this.near(x, z, radius + 0.01)) {
      if (c.active && c.bottom < y + 1.8 && c.top > y + 0.38 && Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius) return false;
    }
    return true;
  }
  viewClear(x: number, y: number, z: number, radius: number) {
    if (Math.abs(x) > this.size - radius || Math.abs(z) > this.size - radius) return false;
    for (const c of this.near(x, z, radius + 0.01)) if (c.active) {
      const dx = Math.max(0, Math.abs(x - c.x) - c.w / 2), dz = Math.max(0, Math.abs(z - c.z) - c.d / 2);
      const dy = Math.max(c.bottom - y, y - c.top, 0);
      if (dx * dx + dy * dy + dz * dz < radius * radius) return false;
    }
    for (const r of this.ramps) if (Math.abs(x - r.x) < r.w / 2 && Math.abs(z - r.z) < r.d / 2) {
      if (y - radius < rampHeight(r, x, z)) return false;
    }
    return true;
  }
  viewOffset(x: number, y: number, z: number, dx: number, dz: number, radius: number) {
    // Sweep the head, rather than testing only the end point: a thin wall cannot be crossed.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.02));
    let fraction = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.viewClear(x + dx * t, y, z + dz * t, radius)) break;
      fraction = t;
    }
    return fraction;
  }
  move(p: Point, dx: number, dz: number, feet: number, radius = 0.35) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
    for (let i = 0; i < steps; i++) {
      const nx = p.x + dx / steps, nz = p.z + dz / steps;
      if (this.clear(nx, p.z, feet, radius) && this.ground(nx, p.z, feet) < feet + 0.48) p.x = nx;
      if (this.clear(p.x, nz, feet, radius) && this.ground(p.x, nz, feet) < feet + 0.48) p.z = nz;
      feet = Math.max(feet, this.ground(p.x, p.z, feet));
    }
  }
  /**
   * True when the straight segment a-b is blocked by solid geometry (colliders or floor slabs).
   * Walks the 2 m grid cells crossed by the segment, so long sight lines stay cheap.
   */
  blocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    this.index();
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const s = ++this.stamp;
    const test = (c: Collider) => {
      if (!c.active || this.stamps.get(c) === s) return false;
      this.stamps.set(c, s);
      let t0 = 0, t1 = 1;
      const slab = (p: number, d: number, lo: number, hi: number) => {
        if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
        let u0 = (lo - p) / d, u1 = (hi - p) / d; if (u0 > u1) [u0, u1] = [u1, u0];
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); return t0 <= t1;
      };
      return slab(ax, dx, c.x - c.w / 2, c.x + c.w / 2) && slab(az, dz, c.z - c.d / 2, c.z + c.d / 2) && slab(ay, dy, c.bottom, c.top) && t1 > 0.001 && t0 < 0.999;
    };
    let cx = Math.floor(ax / CELL), cz = Math.floor(az / CELL);
    const ex = Math.floor(bx / CELL), ez = Math.floor(bz / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdz = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tmx = dx !== 0 ? ((dx > 0 ? (cx + 1) * CELL : cx * CELL) - ax) / dx : Infinity;
    let tmz = dz !== 0 ? ((dz > 0 ? (cz + 1) * CELL : cz * CELL) - az) / dz : Infinity;
    for (let n = 0; n < 200; n++) {
      const k = this.cellKey(cx, cz);
      for (const c of this.grid.get(k) ?? []) if (test(c)) return true;
      for (const c of this.platformGrid.get(k) ?? []) if (test(c)) return true;
      if (cx === ex && cz === ez) break;
      if (tmx < tmz) { if (tmx > 1) break; tmx += tdx; cx += stepX; }
      else { if (tmz > 1) break; tmz += tdz; cz += stepZ; }
    }
    return false;
  }
  path(start: Point, end: Point): Point[] {
    const cell = (p: Point) => [Math.round(p.x), Math.round(p.z)];
    const [sx, sz] = cell(start), [ex, ez] = cell(end);
    const key = (x: number, z: number, y = 0) => `${x},${z},${Math.round(y)}`;
    const sy = start.y ?? 0, ey = end.y ?? 0;
    const open = new Heap();
    const startKey = key(sx, sz, sy);
    open.push({ x: sx, z: sz, y: sy, g: 0, f: 0, key: startKey });
    const parent = new Map<string, string>();
    const costs = new Map<string, number>([[startKey, 0]]);
    const closed = new Set<string>();
    let target = startKey, nearest = Infinity;
    for (let n = 0; open.size && n < 6000; n++) {
      const p = open.pop();
      if (closed.has(p.key)) continue; closed.add(p.key);
      const distance = Math.hypot(p.x - ex, p.z - ez, p.y - ey);
      if (distance < nearest) { nearest = distance; target = p.key; }
      if (distance < 1.5) break;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = p.x + dx, z = p.z + dz, y = this.ground(x, z, p.y), k = key(x, z, y);
        if (closed.has(k) || Math.abs(y - p.y) > 0.5 || !this.clear(x, z, y)) continue;
        const g = p.g + 1 + Math.abs(y - p.y) * 0.5;
        if (g >= (costs.get(k) ?? Infinity)) continue;
        costs.set(k, g); parent.set(k, p.key);
        open.push({ x, z, y, g, f: g + Math.hypot(x - ex, z - ez, y - ey) * 1.05, key: k });
      }
    }
    const route: Point[] = [];
    while (parent.has(target)) { const [x, z, y] = target.split(',').map(Number); route.push({ x, z, y: this.ground(x, z, y + 0.4) }); target = parent.get(target)!; }
    return route.reverse();
  }
}
