import { describe, expect, it } from 'vitest';
import { Kit, STOREY } from '../src/world/kit';
import { buildLayout, LAYOUTS } from '../src/world/layouts';
import type { Point } from '../src/world/navigation';

const build = (i: number) => { const kit = new Kit(null, null, 101 + i); const layout = buildLayout(kit, i); return { kit, layout }; };
const reach = (kit: Kit, from: Point, to: Point) => {
  const route = kit.nav.path({ x: from.x, z: from.z, y: from.y ?? 0 }, { x: to.x, z: to.z, y: to.y ?? 0 });
  const end = route.at(-1) ?? { x: from.x, z: from.z, y: from.y ?? 0 };
  return Math.hypot(end.x - to.x, end.z - to.z) < 2.2 && Math.abs((end.y ?? 0) - (to.y ?? 0)) < 0.6;
};

describe.each(LAYOUTS.map((_, i) => i))('map %i layout', index => {
  const { kit, layout } = build(index);
  it('has the required supplies and several spawns', () => {
    expect(layout.health).toHaveLength(5);
    expect(layout.ammo).toHaveLength(2);
    expect(Math.hypot(layout.ammo[0].x - layout.ammo[1].x, layout.ammo[0].z - layout.ammo[1].z)).toBeGreaterThan(25);
    expect(layout.playerSpawns.length).toBeGreaterThanOrEqual(3);
    expect(kit.enemySpawns.length).toBeGreaterThanOrEqual(12);
    expect(layout.barrels.length).toBeGreaterThanOrEqual(6);
  });
  it('places spawns, supplies, barrels and crates in clear space', () => {
    const points = [...layout.playerSpawns, ...kit.enemySpawns, ...layout.health, ...layout.ammo, ...layout.barrels, ...layout.crates];
    const bad = points.filter(p => !kit.nav.clear(p.x, p.z, p.y ?? kit.nav.ground(p.x, p.z)));
    expect(bad).toEqual([]);
  });
  it('connects every enemy spawn and supply to the first player spawn', () => {
    const start = layout.playerSpawns[0];
    const targets = [...kit.enemySpawns, ...layout.health, ...layout.ammo, ...layout.playerSpawns.slice(1)];
    const unreachable = targets.filter(t => !reach(kit, start, t));
    expect(unreachable).toEqual([]);
  });
  it('lets actors climb to upper floors', () => {
    const upper = kit.enemySpawns.filter(p => (p.y ?? 0) > 3);
    expect(upper.length).toBeGreaterThanOrEqual(4);
    for (const p of upper.slice(0, 3)) expect(kit.nav.ground(p.x, p.z, p.y!)).toBeCloseTo(p.y!, 1);
  });
});

describe('storey geometry', () => {
  it('keeps stair steps within the navigation step limit', () => {
    expect(STOREY.f1 / STOREY.stairLen).toBeLessThanOrEqual(0.5);
  });
});
