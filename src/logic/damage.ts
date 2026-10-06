export function enemyHit(health: number, head: boolean, melee = false) { return head || melee ? 0 : Math.max(0, health - 1); }
export function blastDamage(distance: number, radius: number, maximum: number) {
  return Math.max(0, maximum * (1 - Math.max(0, distance) / radius));
}
export function segmentSphere(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, radius: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(ax + dx * t - cx, az + dz * t - cz) < radius;
}
