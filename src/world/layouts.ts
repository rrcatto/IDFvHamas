import { Vector3 } from '../babylon';
import { Kit, STOREY, type BuildingSpec } from './kit';
import type { Point } from './navigation';

/** Gameplay points produced by a map layout. Supplies and spawns are validated by tests/maps.test.ts. */
export type Layout = { playerSpawns: Point[]; health: Point[]; ammo: Point[]; barrels: Point[]; crates: Point[] };
const F1 = STOREY.f1;

// ------------------------------------------------------------------------------------------ Market Quarter
function market(k: Kit): Layout {
  const sand = 'sandstone@#e4ddd3', clay = 'clayPlaster@#ece6dc', beige = 'beigePlaster@#f0ece4', damaged = 'damagedPlaster', brick = 'plasterBrick@#e8e2d8';
  k.ground(-45, -45, 45, 45, 'dryRocks', 0);
  k.ground(-34.5, -34.5, 34.5, 34.5, 'pavers', 0.01);
  k.ground(-21, -19, 21, 18, 'pavers', 0.02);
  for (const [x, z, r] of [[-12, 12, 4], [14, -9, 3], [-24, 34, 3], [30, -33, 3]] as const) k.ground(x - r, z - r, x + r, z + r, 'sandCracks', 0.025);
  const B: BuildingSpec[] = [
    { x: -26, z: -26, w: 12, d: 11, wall: sand, upperWall: clay, doors: [['n', 3], ['e', -1]], shops: [['n', -2, 3.2, 'half']], stairs: { kind: 'inner', side: 'w' }, sign: 'Provisions' },
    { x: -9, z: -25, w: 11, d: 12, wall: clay, doors: [['n', -2.5], ['w', 3]], shops: [['n', 2.4, 3.0, 'open']], stairs: { kind: 'inner', side: 'e' }, sign: 'Bakery', damage: { holes: [['s', 1, 1]] } },
    { x: 9, z: -26, w: 11, d: 10, wall: beige, doors: [['n', -1.5], ['w', -2]], shops: [['n', 3, 2.8, 'closed']], stairs: { kind: 'inner', side: 'e' }, sign: 'Pharmacy', damage: { corner: 'ne' } },
    { x: 26, z: -25, w: 12, d: 12, wall: sand, upperWall: damaged, doors: [['w', -2], ['n', 4.5]], stairs: { kind: 'inner', side: 'n' }, balcony: [['w', 2]] },
    { x: -26, z: 25, w: 12, d: 11, wall: damaged, doors: [['s', -2], ['w', 2]], shops: [['s', 2.6, 3.0, 'closed']], stairs: { kind: 'inner', side: 'e' }, sign: 'Tailor', damage: { holes: [['s', -4, 1]], burnt: true } },
    { x: -9, z: 24, w: 11, d: 11, wall: brick, upperWall: clay, doors: [['s', -1], ['e', -3]], shops: [['s', 3.0, 2.8, 'half']], stairs: { kind: 'outer', side: 'n', at: 0 }, bridgeDoors: [['e', 2]], sign: 'Barber' },
    { x: 9, z: 24, w: 11, d: 12, wall: sand, doors: [['s', -1.5], ['w', -3.5]], shops: [['s', 2.6, 3.0, 'open']], stairs: { kind: 'inner', side: 'e' }, bridgeDoors: [['w', 2]], sign: 'Electronics', damage: { burnt: true } },
    { x: 26, z: 24, w: 12, d: 11, wall: damaged, doors: [['s', 0], ['w', 4.2]], stairs: { kind: 'inner', side: 'w' }, damage: { roofless: true } },
    { x: -27, z: 0, w: 11, d: 13, wall: clay, upperWall: sand, doors: [['e', 0], ['n', 2]], shops: [['e', -3.1, 3.2, 'open'], ['e', 3.1, 3.2, 'half']], stairs: { kind: 'inner', side: 'w' }, sign: 'Grocery', damage: { holes: [['e', 0, 1]] } },
    { x: 27, z: 1, w: 12, d: 12, wall: beige, upperWall: brick, doors: [['w', -3], ['w', 3], ['s', 2]], stairs: { kind: 'inner', side: 'e' }, balcony: [['w', 0]], damage: { corner: 'se' } },
    { x: -28, z: -13, w: 8, d: 7, wall: sand, doors: [['n', -1], ['w', 0]], stairs: { kind: 'outer', side: 'e', at: 2.5 }, windows: 2.6, spawns: 1 },
    { x: -28, z: 13, w: 8, d: 7, wall: clay, doors: [['s', 0], ['w', 1]], stairs: { kind: 'outer', side: 'e', at: 2.5 }, windows: 2.6, damage: { holes: [['n', 0, 1]] }, spawns: 1 },
    { x: 27, z: -12.5, w: 10, d: 6.5, wall: brick, doors: [['n', 2], ['w', 1]], stairs: { kind: 'inner', side: 's' }, damage: { roofless: true }, windows: 2.8, spawns: 1 },
    { x: 27, z: 12.75, w: 10, d: 5.5, wall: sand, doors: [['s', -2], ['w', 0]], stairs: { kind: 'inner', side: 'n' }, windows: 2.8, spawns: 1 },
  ];
  B.forEach(b => k.building({ ...b, inner: 'whitePlaster@#e2d7c3!in', trim: 'sandstone' }));
  // covered footbridge between the two northern shops
  k.slab(0, 26, 7.0, 2.4, F1, 0.3, 'dirtyConcrete', 'planks');
  for (const z of [24.85, 27.15]) { k.box(0, F1 + 0.5, z, 7, 1.0, 0.1, 'rustyMetal'); }
  k.box(0, F1 + 2.6, 26, 7.2, 0.08, 2.8, 'corrugated', { collide: false, rotZ: 0.05 });
  // covered market canopy with a collapsed bay
  for (const [x, z] of [[-14, -6], [-4, -6], [-14, 4], [-4, 4], [-9, -6], [-9, 4]] as const) k.box(x, 1.8, z, 0.3, 3.6, 0.3, 'rustyMetal');
  for (let i = 0; i < 5; i++) {
    const x = -13 + i * 2.2; if (i === 3) continue;
    k.box(x, 3.65, -1, 2.3, 0.05, 10.5, 'corrugated', { collide: false, rotZ: i % 2 ? 0.04 : -0.04 });
  }
  k.box(-6.5, 2.1, 1, 2.3, 0.05, 6, 'corrugated', { collide: false, rotZ: 1.05 });
  k.stall(-11.5, -3, 0, '#7b2f22'); k.stall(-6.5, -3.4, 0, '#2f5468'); k.stall(-11.5, 2, Math.PI, '#8f7a32'); k.stall(-6.5, 2.6, Math.PI, '#556b2f');
  k.stall(8, 11, 0.4, '#6e3a52'); k.stall(13, -15, 1.3, '#2f5468'); k.stall(-15, 13, -0.6, '#8a4b20');
  // dry fountain basin at the square centre
  k.cylinder(6, 0.35, -2, 4.2, 0.7, 'sandstone', { collide: true, tess: 10 });
  k.cylinder(6, 0.75, -2, 0.7, 1.5, 'sandstone', { collide: true, tess: 8 });
  k.rubble(6, -2, 3.5, 14);
  // barricades, wrecks and rubble in the lanes
  k.sandbags(9, 9, 4.2, true); k.sandbags(-9, -14, 3.6, true); k.sandbags(-17, 3, 3.0, false, 5);
  k.car('sedanBurnt', 0.8, -13.5, 0.25); k.car('carBroken', -17.2, -9, 1.62);
  k.mound(16, 12, 2.2, 1.1); k.mound(-1.5, 31, 1.8, 0.9);
  for (const [x, z, r] of [[-17.5, -26, 0.4], [17.5, 26, 1.1], [2.2, -33.4, 2.4], [-33.5, 5, 0.9]] as const) k.prop('tyre', x, z, r);
  for (const [x, z] of [[-16, -18], [15.6, 17.4], [-19.5, 17], [19.7, -17.3]] as const) k.prop('trashbag', x, z, x * 0.3);
  for (const [x, z, r] of [[-13.6, -6.6, 0.4], [-3.2, 6, 2.5], [12, 4.5, 1.1], [3.4, -17.6, 0.2]] as const) k.prop('chair', x, z, r, { collide: false });
  k.prop('table', 11.2, 5.5, 0.3); k.prop('generator', -18.6, 9.6, 0.9); k.prop('dumpster', 19.3, -1.5, Math.PI / 2);
  k.prop('jerrycan', -17.9, 8.9, 0.3); k.prop('lpg', 18.9, 4.5, 0); k.prop('propane', -4.3, 15.4, 0);
  k.cables([[-17.5, -19], [-17.5, -6.8], [-17.5, 7], [-17.5, 18.5]]);
  k.cables([[17.7, -18.6], [17.7, -6], [17.7, 8]]);
  k.cables([[-3.8, -18.3], [3.8, -6.8], [3.8, 6.4], [-3.8, 17.6]]);
  k.enemySpawns.push({ x: -33.5, z: 31 }, { x: 33.5, z: -31 }, { x: -12, z: -33.4 }, { x: 12, z: 33.4 }, { x: -33.6, z: 8.5 }, { x: 33.7, z: 6 });
  k.boundary([sand, clay, damaged]);
  k.skyline([sand, clay, beige, damaged]);
  return {
    playerSpawns: [{ x: 0, z: -33 }, { x: -33.6, z: -17 }, { x: 0, z: 33.3 }, { x: 33.8, z: 16 }],
    health: [{ x: -1.8, z: -18 }, { x: -19, z: 0 }, { x: 17.5, z: -4 }, { x: -6, z: 15.5 }, { x: 26, z: -25, y: F1 }],
    ammo: [{ x: -19.5, z: -16.5 }, { x: 19.3, z: 16.2 }],
    barrels: [{ x: -12, z: 8 }, { x: -12.8, z: 8.8 }, { x: 15.5, z: -12 }, { x: -1.6, z: 10 }, { x: 18.6, z: 6.4 }, { x: -18.2, z: -13.5 }, { x: 5.2, z: 15.8 }, { x: 16.4, z: 16.6 }],
    crates: [{ x: -15, z: 10 }, { x: 11.2, z: -11.6 }, { x: 3.6, z: 12 }, { x: -5.8, z: -15.2 }, { x: 18.6, z: -8.4 }],
  };
}

// ------------------------------------------------------------------------------------------ Residential District
function residential(k: Kit): Layout {
  const white = 'whitePlaster', grey = 'greyPlaster', cracked = 'crackedWall', painted = 'paintedConcrete', blue = 'bluePlaster', hacked = 'hackedConcrete', block = 'cinderblock';
  k.ground(-45, -45, 45, 45, 'gravelSand', 0);
  k.ground(-8, -35, 8, 35, 'asphalt', 0.02);
  k.ground(-35, -5, 35, 5, 'asphalt', 0.021);
  for (const s of [-1, 1]) {
    for (const [z0, z1] of [[-35, -5], [5, 35]]) k.ground(s > 0 ? 8 : -10.5, z0, s > 0 ? 10.5 : -8, z1, 'interlock', 0.15);
    k.collider(s * 9.25, -20, 2.5, 30, 0, 0.15); k.collider(s * 9.25, 20, 2.5, 30, 0, 0.15);
  }
  // median with dead palms and lamps
  k.ground(-1, -35, 1, -5, 'pavers', 0.16); k.ground(-1, 5, 1, 35, 'pavers', 0.16);
  k.collider(0, -20, 2, 30, 0, 0.16); k.collider(0, 20, 2, 30, 0, 0.16);
  for (const z of [-30, -22, -14, 13, 22, 30]) k.prop('streetLamp', 0.3, z, z > 0 ? Math.PI : 0);
  for (const z of [-26, -18, 17.5, 26]) k.box(0, 0.45, z, 1.2, 0.5, 1.2, 'dirtyConcrete');
  k.box(5.5, 0.18, 18, 0.25, 0.25, 3.8, 'flat:lamp:#3d4040:.5:.7', { collide: false, rotY: 0.6 });
  const B: BuildingSpec[] = [
    { x: -24, z: 27, w: 14, d: 10, wall: white, upperWall: painted, doors: [['s', 0], ['e', 0]], stairs: { kind: 'inner', side: 'w' }, balcony: [['s', -4], ['s', 4]] },
    { x: -25, z: 12, w: 12, d: 10, wall: grey, doors: [['e', -2], ['n', 3]], stairs: { kind: 'inner', side: 'w' }, damage: { burnt: true, holes: [['e', 2, 1], ['s', -2, 0]] } },
    { x: 22, z: 26, w: 14, d: 11, wall: blue, upperWall: white, doors: [['w', -3], ['s', 3]], stairs: { kind: 'inner', side: 'e' }, balcony: [['w', 2]] },
    { x: 24, z: 12, w: 12, d: 10, wall: cracked, doors: [['w', 0], ['s', -3]], stairs: { kind: 'inner', side: 'e' }, damage: { corner: 'nw' } },
    { x: -23, z: -15, w: 14, d: 12, wall: painted, upperWall: grey, doors: [['n', 3], ['e', -3]], stairs: { kind: 'inner', side: 'w' }, balcony: [['n', -3], ['e', 2]] },
    { x: -22, z: -29, w: 16, d: 9, wall: hacked, doors: [['n', -4], ['n', 4], ['e', 0]], stairs: { kind: 'inner', side: 's' }, damage: { holes: [['n', 0, 1]] } },
    { x: 22, z: -14, w: 14, d: 11, wall: grey, doors: [['w', 2], ['n', -3]], stairs: { kind: 'inner', side: 'e' }, damage: { roofless: true, burnt: true } },
    { x: 23, z: -28, w: 12, d: 10, wall: white, upperWall: blue, doors: [['w', -2], ['n', 2]], stairs: { kind: 'inner', side: 'e' }, balcony: [['n', -3]] },
  ];
  B.forEach(b => k.building({ ...b, inner: 'whitePlaster@#d6d0c4!in', trim: 'dirtyConcrete', floor: 'interiorTiles!in', upperFloor: 'wornTiles!in' }));
  // courtyard walls with gates along the boulevard
  const courtWall = (x: number, z0: number, z1: number, gates: number[]) => {
    const cuts = [z0, ...gates.flatMap(g => [g - 1.3, g + 1.3]), z1];
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 0.1) {
      const zc = (cuts[i] + cuts[i + 1]) / 2, len = cuts[i + 1] - cuts[i];
      k.box(x, 1.1, zc, 0.3, 2.2, len, block); k.box(x, 2.27, zc, 0.36, 0.14, len, 'dirtyConcrete', { collide: false });
    }
  };
  courtWall(-11, 6.5, 34.5, [12, 26]); courtWall(11, 6.5, 34.5, [10, 24]); courtWall(-11, -34.5, -6.5, [-12, -28]); courtWall(11, -34.5, -6.5, [-14, -28]);
  for (const [x, z, s] of [[-15, 20, 2.2], [15, -21, 2.6], [-14, -22, 1.6]] as const) k.ground(x - s, z - s, x + s, z + s, 'dryGround', 0.025);
  // pancaked block remains and fallen floors
  k.mound(22, -14, 4.5, 1.5); k.mound(29.5, -21.5, 2.2, 0.9);
  for (let i = 0; i < 4; i++) k.box(22 + k.range(-4, 4), 1.4 + i * 0.3, -14 + k.range(-3, 3), k.range(4, 6), 0.3, k.range(3, 5), 'dirtyConcrete', { collide: false, rotX: k.range(-0.3, 0.3), rotZ: k.range(-0.3, 0.3) });
  // boulevard: wrecks, checkpoint, crater
  k.car('sedanBurnt', 4.3, 17.5, 0.12); k.car('pickupBurnt', -4.6, -21.5, 3.05, true); k.car('hatchRust', 5.2, -10.5, 2.9); k.car('carBroken', -22, 1.2, 1.57);
  k.car('hatchRust', -15, 30.5, 1.4); k.car('sedanBurnt', 14, -26.5, 0.1);
  k.crater(3.5, 0.5, 2.4); k.crater(-4, 23, 1.6);
  for (const x of [-6.5, -4.6, 4.6, 6.5]) k.barrier(x, -7.5, x < 0 ? 0.1 : -0.1);
  k.barrier(-2.8, 7.5, 0.2); k.barrier(2.6, 8.4, -0.3);
  k.sandbags(-5.5, 6.6, 3.2, true); k.sandbags(20, 3.2, 3.6, true, 5); k.sandbags(-26, -3.2, 3.6, true, 5);
  for (const [x, z, r] of [[-13.8, 15.5, 0.3], [13.6, -24, 1.2], [-12.7, -30, 2], [14, 31, 0.8]] as const) k.prop('chair', x, z, r, { collide: false });
  k.prop('generator', -15.2, 26, 0.6); k.prop('utilityBox', 10.3, -2.6, Math.PI / 2); k.prop('utilityBox', -10.3, 4.6, -Math.PI / 2);
  k.prop('dumpster', 13.2, 16.5, 0.2); k.prop('dumpster', -13.4, -18.5, 1.4);
  for (const [x, z] of [[-12.6, 9.5], [12.5, 28.5], [-31, -4], [31.5, 3.8], [12.6, -9.5]] as const) k.prop('trashbag', x, z, x);
  k.prop('bush', -16, 31.5, 0.2, { collide: false }); k.prop('bush', 16.5, -32, 1.4, { collide: false });
  k.cables([[-10.6, -33], [-10.6, -18], [-10.6, -5.6], [-10.6, 6], [-10.6, 20], [-10.6, 33]]);
  k.cables([[10.6, -33], [10.6, -18], [10.6, -5.6], [10.6, 6], [10.6, 20], [10.6, 33]]);
  k.enemySpawns.push({ x: -33.5, z: 33.5 }, { x: 33.5, z: -33.5 }, { x: 33, z: 33.4 }, { x: -33, z: -33.6 }, { x: -16, z: -1.5 }, { x: 22, z: -1.5 });
  k.boundary([block, white, grey]);
  k.skyline([white, grey, painted, cracked]);
  return {
    playerSpawns: [{ x: 0, z: -33.5 }, { x: -33.5, z: 0 }, { x: 33.5, z: 0 }, { x: 0, z: 33.5 }],
    health: [{ x: -15, z: 16 }, { x: 14.5, z: -22 }, { x: -5.5, z: 30.5 }, { x: 26, z: 2.5 }, { x: -24, z: -15, y: F1 }],
    ammo: [{ x: -14.5, z: 28.5 }, { x: 14.2, z: -31 }],
    barrels: [{ x: 6.8, z: 12.5 }, { x: 7.3, z: 13.2 }, { x: -6.6, z: -14 }, { x: -13.6, z: 22.6 }, { x: 13.7, z: 6.8 }, { x: 28, z: -4 }, { x: -29.5, z: 4 }, { x: 14, z: -16.5 }],
    crates: [{ x: -3, z: -14 }, { x: 3.2, z: 26 }, { x: -18, z: -3.4 }, { x: 16.2, z: 3.4 }, { x: 13.2, z: 19.5 }],
  };
}

// ------------------------------------------------------------------------------------------ Ruined Crossing
function crossing(k: Kit): Layout {
  const block = 'cinderblock', panel = 'panelConcrete', slabC = 'slabConcrete@#b9b4aa', dirty = 'dirtyConcrete', layered = 'layeredConcrete';
  const DECK = 5.5;
  k.ground(-45, -45, 45, 45, 'rockyGround', 0);
  k.ground(-7, -35, 7, 35, 'roadDamaged', 0.02);
  k.ground(-35, -1, 35, 8, 'asphaltWorn', 0.021);
  for (const [x, z, s] of [[-14, -12, 5], [16, 12, 4], [-12, 28, 4], [26, -6, 5]] as const) k.ground(x - s, z - s, x + s, z + s, 'burnt', 0.025);
  k.ground(-30, 9, -16, 15, 'dryGround', 0.024);
  // overpass deck, parapets and piers
  k.slab(6.5, 3.5, 57, 9, DECK, 0.8, slabC, 'asphalt');
  for (const x of [-14, 0, 14, 28]) for (const z of [0.6, 6.4]) k.box(x, (DECK - 0.8) / 2, z, 1.3, DECK - 0.8, 1.3, slabC);
  for (const x of [-14, 0, 14, 28]) k.box(x, DECK - 1.0, 3.5, 1.5, 0.5, 8.6, slabC, { collide: false });
  for (const z of [-0.85, 7.85]) for (let x = -21.5; x < 34.5; x += 4) {
    if ((x > 3 && x < 8 && z < 0) || (x > 17 && x < 22 && z > 0)) continue; // shell-broken parapet
    k.box(x + 2, DECK + 0.45, z, 4, 0.9, 0.3, slabC);
  }
  // collapsed western span forms a climbable ramp down to the ground
  k.nav.ramps.push({ x: -28.5, z: 3.5, w: 13, d: 9, height: DECK, dir: 'x+', base: 0 });
  const len = Math.hypot(13, DECK), ang = Math.atan2(DECK, 13);
  k.box(-28.5, DECK / 2 - 0.35, 3.5, len, 0.7, 9, slabC, { collide: false, rotZ: ang, shadow: true });
  k.box(-28.5, DECK / 2 - 0.3, 3.5, len, 0.06, 8.6, 'asphalt', { collide: false, rotZ: ang });
  for (let i = 0; i < 12; i++) k.box(-22 + k.range(-0.2, 0.4), DECK - 0.4 + k.range(-0.3, 0.2), -0.5 + i * 0.8, 0.9, 0.03, 0.03, 'rustyMetal', { collide: false, rotZ: k.range(-0.6, 0.2), shadow: false });
  k.rubble(-21, 3.5, 3, 18);
  // checkpoint
  for (const x of [-6.5, -5, -1.2, 0.3, 4.5, 6]) k.tWall(x, -14, true);
  k.sandbags(-4.5, -20, 3.4, true); k.sandbags(-6.1, -21.6, 2.6, false); k.sandbags(-2.9, -21.6, 2.6, false);
  k.box(5, 1.25, -18, 2.2, 2.5, 0.2, block); k.box(5, 1.25, -15.6, 2.2, 2.5, 0.2, block); k.box(6.05, 1.25, -16.8, 0.2, 2.5, 2.2, block);
  k.box(5, 2.62, -16.8, 2.6, 0.2, 2.8, 'corrugated', { collide: false });
  for (const [x, z] of [[-5, -8.5], [2.2, -9.8], [6, -25], [-1, 18], [4.5, 20.5]] as const) k.hedgehog(x, z);
  k.crater(0, -26, 2.2); k.crater(-3, 14.5, 2); k.crater(12, -3, 1.6); k.crater(-10, 22, 1.4);
  const B: BuildingSpec[] = [
    { x: -22, z: -23, w: 14, d: 11, wall: block, upperWall: panel, doors: [['n', -3], ['e', 3.5]], shops: [['e', -2, 4.2, 'half']], stairs: { kind: 'inner', side: 'w' }, sign: 'Auto Repair', damage: { burnt: true } },
    { x: 22, z: -23, w: 13, d: 11, wall: dirty, upperWall: layered, doors: [['w', 0], ['n', 3]], stairs: { kind: 'inner', side: 'e' }, damage: { corner: 'nw', holes: [['w', 3.5, 1]] } },
    { x: -23, z: 22, w: 16, d: 12, wall: block, doors: [['e', -2], ['s', 4]], stairs: { kind: 'inner', side: 'w' }, damage: { roofless: true, holes: [['s', -3, 0], ['e', 3, 1]] }, windows: 3.6 },
    { x: 23, z: 22, w: 12, d: 12, wall: layered, upperWall: dirty, doors: [['w', 3], ['s', -3]], stairs: { kind: 'inner', side: 'e' }, balcony: [['w', -2], ['s', 1.5]], damage: { burnt: true } },
    { x: -24, z: -6, w: 10, d: 7, wall: panel, doors: [['n', 2], ['e', 0]], stairs: { kind: 'inner', side: 's' }, windows: 2.8, damage: { holes: [['w', 0, 1]] }, spawns: 1 },
    { x: 26, z: 32.75, w: 12, d: 4, wall: block, doors: [['s', 3]], stairs: { kind: 'outer', side: 's', at: -3 }, windows: 2.6, spawns: 1, roofDetail: false },
  ];
  B.forEach(b => k.building({ ...b, inner: 'greyPlaster@#cfccc4!in', trim: slabC, floor: 'dirtyTiles!in', upperFloor: 'wornTiles!in' }));
  // wrecked gas station canopy
  for (const [x, z] of [[17.5, -10.5], [26.5, -10.5], [17.5, -5.5], [26.5, -5.5]] as const) k.box(x, 2.1, z, 0.35, 4.2, 0.35, 'redMetal');
  k.box(22, 4.35, -8, 10.4, 0.35, 6.2, 'rustyMetal', { collide: false, rotX: 0.06, rotZ: -0.08 });
  for (const x of [20.2, 23.8]) k.box(x, 0.7, -8, 0.8, 1.4, 0.5, 'redMetal');
  k.car('pickupBurnt', -2.8, 11.5, 0.4, true); k.car('sedanBurnt', 10.4, -15.5, 1.1, true); k.car('carBroken', -12.5, -11, 2.4);
  k.car('hatchRust', 3.2, 3.4, 1.62); k.car('sedanBurnt', 8, 2.2, 0.15);
  // the deck is cover for rocket teams
  k.prop('jersey', -10, 5.2, 0.1, { y: DECK }); k.prop('jersey', 20, 1.6, -0.2, { y: DECK }); k.prop('jersey', 32.5, 1.8, Math.PI / 2, { y: DECK });
  k.prop('jersey', 32.5, 5.2, Math.PI / 2, { y: DECK }); k.prop('sedanBurnt', 5, 2.4, 1.4, { y: DECK });
  k.firePoints.push({ at: new Vector3(5, DECK + 0.5, 2.4), scale: 0.8, light: false });
  k.sandbags(-16, 3.5, 3.2, false, 5, DECK);
  for (const [x, z] of [[-30, -31], [30, -32], [-31.5, 31], [12.5, 31]] as const) k.mound(x, z, 2, 1);
  k.mound(-8, 30, 2.6, 1.2); k.mound(10, 20.5, 1.8, 0.9);
  for (const [x, z, r] of [[-7.8, -30, 0.2], [7.8, 30, 1.4], [16.4, -14.5, 0.6], [-17.5, 30.5, 2]] as const) k.prop('tyre', x, z, r);
  k.prop('generator', 17.6, -18.4, 0.5); k.prop('lpg', 26.8, -12.3, 0); k.prop('lpg', 27.3, -12.8, 0); k.prop('dumpster', -14.6, -29.6, Math.PI / 2);
  k.cables([[-8, -34], [-8, -20], [-8, -2.4], [-8, 10], [-8, 24], [-8, 34]], 7.6);
  k.enemySpawns.push({ x: 25, z: 3.5, y: DECK }, { x: -6, z: 3.5, y: DECK }, { x: 12, z: 5, y: DECK }, { x: -33, z: 33 }, { x: 33.5, z: 31 }, { x: -33.5, z: 16 }, { x: 33.5, z: -33 });
  k.boundary([block, panel, dirty], 5.2);
  k.skyline([block, panel, dirty, layered]);
  return {
    playerSpawns: [{ x: 0, z: -33.5 }, { x: -33.6, z: -13 }, { x: 33.6, z: -13 }, { x: -2, z: 33.5 }],
    health: [{ x: -10.5, z: -17.5 }, { x: 12.5, z: -18.5 }, { x: -12, z: 13.5 }, { x: 13, z: 12.5 }, { x: -1.5, z: 4.5, y: DECK }],
    ammo: [{ x: -31, z: -14 }, { x: 30.5, z: 12 }],
    barrels: [{ x: 16.6, z: -11.6 }, { x: 17.4, z: -12.3 }, { x: 16.4, z: -12.6 }, { x: -9.6, z: -6.4 }, { x: 9.4, z: 9.4 }, { x: -17, z: 13.6 }, { x: 3.8, z: -20.4 }, { x: 0.8, z: 5.6, y: DECK }],
    crates: [{ x: -3, z: -9.6 }, { x: 4, z: -11 }, { x: 13.6, z: 17 }, { x: -13.6, z: -16.2 }, { x: -18.5, z: 9.5 }],
  };
}

export const LAYOUTS = [market, residential, crossing];
export function buildLayout(k: Kit, index: number) { const layout = LAYOUTS[index](k); k.finishSpawns(); return layout; }
