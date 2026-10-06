import { describe, expect, it } from 'vitest';
import { Navigation } from '../src/world/navigation';

describe('lean head collision', () => {
  it('permits a full lateral peek in open space without requiring body movement', () => {
    const nav = new Navigation();
    expect(nav.viewOffset(0, 1.65, 0, -.46, 0, .12)).toBe(1);
    expect(nav.viewOffset(0, 1.06, 0, .46, 0, .12)).toBe(1);
  });

  it('stops the head short of an adjacent wall', () => {
    const nav = new Navigation();
    nav.colliders.push({ x: .55, z: 0, w: .2, d: 5, bottom: 0, top: 3, active: true });
    const fraction = nav.viewOffset(0, 1.65, 0, .46, 0, .12);
    expect(fraction).toBeGreaterThan(.5);
    expect(fraction).toBeLessThan(.75);
    expect(nav.viewClear(.46 * fraction, 1.65, 0, .12)).toBe(true);
  });

  it('cannot pass through a thin wall even when the destination is clear', () => {
    const nav = new Navigation();
    nav.colliders.push({ x: .23, z: 0, w: .015, d: 5, bottom: 0, top: 3, active: true });
    expect(nav.viewClear(.46, 1.65, 0, .12)).toBe(true);
    expect(nav.viewOffset(0, 1.65, 0, .46, 0, .12)).toBeLessThan(.3);
  });

  it('can look over low cover standing, but blocks a crouched head', () => {
    const nav = new Navigation();
    nav.colliders.push({ x: .55, z: 0, w: .2, d: 5, bottom: 0, top: 1.3, active: true });
    expect(nav.viewOffset(0, 1.65, 0, .46, 0, .12)).toBe(1);
    expect(nav.viewOffset(0, 1.06, 0, .46, 0, .12)).toBeLessThan(1);
  });

  it('handles peeking around a corner and releases destroyed cover', () => {
    const nav = new Navigation();
    const wall = { x: .55, z: 0, w: .2, d: 1, bottom: 0, top: 3, active: true };
    nav.colliders.push(wall);
    expect(nav.viewOffset(0, 1.65, .7, .46, 0, .12)).toBe(1);
    wall.active = false;
    expect(nav.viewOffset(0, 1.65, 0, .46, 0, .12)).toBe(1);
  });

  it('limits peeking at the world boundary and checks overhead geometry', () => {
    const nav = new Navigation();
    expect(nav.viewOffset(34.65, 1.65, 0, .46, 0, .12)).toBeLessThan(1);
    nav.colliders.push({ x: 0, z: 0, w: 5, d: 5, bottom: 1.7, top: 2, active: true });
    expect(nav.viewClear(0, 1.65, 0, .12)).toBe(false);
    expect(nav.viewClear(0, 1.06, 0, .12)).toBe(true);
  });
});
