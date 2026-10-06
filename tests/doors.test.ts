import { describe, expect, it } from 'vitest';
import { Kit, type BuildingSpec } from '../src/world/kit';
import { buildLayout, LAYOUTS } from '../src/world/layouts';
import { RULES } from '../src/config/game';

type Doorway = { label: string; x: number; z: number; nx: number; nz: number; y: number };

/** Build a map headlessly and list every walk-through opening in its buildings. */
function doorways(index: number) {
  const kit = new Kit(null, null, 101 + index);
  const specs: BuildingSpec[] = [];
  const original = kit.building.bind(kit);
  kit.building = (b: BuildingSpec) => { specs.push(b); return original(b); };
  const layout = buildLayout(kit, index);
  const out: Doorway[] = [];
  for (const [n, b] of specs.entries()) {
    // centre of the opening on the outer face, plus the inward normal
    const at = (side: string, u: number, y: number, label: string) => {
      if (side === 's') out.push({ label, x: b.x + u, z: b.z - b.d / 2, nx: 0, nz: 1, y });
      if (side === 'n') out.push({ label, x: b.x + u, z: b.z + b.d / 2, nx: 0, nz: -1, y });
      if (side === 'w') out.push({ label, x: b.x - b.w / 2, z: b.z + u, nx: 1, nz: 0, y });
      if (side === 'e') out.push({ label, x: b.x + b.w / 2, z: b.z + u, nx: -1, nz: 0, y });
    };
    for (const [side, u] of b.doors) at(side, u, 0, `building ${n} (${b.x},${b.z}) door ${side}${u}`);
    for (const [side, u, , state] of b.shops ?? []) if ((state ?? 'open') === 'open') at(side, u, 0, `building ${n} (${b.x},${b.z}) shop ${side}${u}`);
  }
  return { kit, out, layout };
}

/** Walk the player's collision cylinder from 1.8 m outside to the inside, as the game does. */
function walkThrough(kit: Kit, d: Doorway) {
  const p = { x: d.x - d.nx * 1.8, z: d.z - d.nz * 1.8 };
  let feet = kit.nav.ground(p.x, p.z, d.y + 0.1);
  const dt = 1 / 60, speed = RULES.walkSpeed;
  for (let i = 0; i < 120; i++) {
    kit.nav.move(p, d.nx * speed * dt, d.nz * speed * dt, feet, RULES.playerRadius);
    feet = kit.nav.ground(p.x, p.z, feet);
  }
  const inside = (p.x - d.x) * d.nx + (p.z - d.z) * d.nz;
  return inside;
}

describe.each(LAYOUTS.map((_, i) => i))('map %i doorways', index => {
  const { kit, out, layout } = doorways(index);
  it('has doorways', () => expect(out.length).toBeGreaterThan(8));
  it('lets the player walk through every ground-floor door and open shopfront', () => {
    const blocked = out.map(d => ({ d, inside: walkThrough(kit, d) })).filter(r => r.inside < 1.0).map(r => `${r.d.label}: stopped ${r.inside.toFixed(2)} m from the face`);
    expect(blocked).toEqual([]);
  });
  it('keeps barrels, crates and supplies out of doorway approaches', () => {
    const items = [...layout.barrels, ...layout.crates, ...layout.health, ...layout.ammo].filter(p => (p.y ?? 0) < 0.5);
    expect(items.filter(p => kit.blocksDoor(p.x, p.z, 0.9, 0.9))).toEqual([]);
  });
});
