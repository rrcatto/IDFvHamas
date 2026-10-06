import { Color3, Mesh, MeshBuilder, PBRMaterial, Ray, Scene, StandardMaterial, TransformNode, Vector3, type AbstractMesh } from '../babylon';
import { RULES, type KillSource } from '../config/game';
import { Effects } from '../effects/effects';
import type { GameAudio } from '../audio';

export type ProjectileKind = 'frag' | 'smoke' | 'rocket';
export type Projectile = { mesh: TransformNode; velocity: Vector3; age: number; kind: ProjectileKind; player: boolean; owner?: number; resting: boolean; spin: Vector3 };

export class Projectiles {
  items: Projectile[] = [];
  onBlast?: (position: Vector3, radius: number, damage: number, source: KillSource, player: boolean) => void;
  playerPosition?: () => Vector3;
  templates: Partial<Record<'frag' | 'smoke', AbstractMesh>> = {};
  private rocketMat?: PBRMaterial;
  private glowMat?: StandardMaterial;
  constructor(public scene: Scene, public effects: Effects, public audio?: GameAudio) {}
  private model(kind: ProjectileKind) {
    const t = kind !== 'rocket' ? this.templates[kind] : undefined;
    if (t) {
      const root = new TransformNode(`${kind}-projectile`, this.scene);
      const m = (t as Mesh).clone(`${kind}-mesh`, root, false)!; m.setEnabled(true); m.isPickable = false; m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0);
      for (const c of m.getChildMeshes()) c.isPickable = false;
      return root;
    }
    const root = new TransformNode(`${kind}-projectile`, this.scene);
    if (kind === 'rocket') {
      this.rocketMat ??= (() => { const m = new PBRMaterial('rocket-mat', this.scene); m.albedoColor = new Color3(0.22, 0.25, 0.17); m.roughness = 0.6; m.metallic = 0.3; return m; })();
      this.glowMat ??= (() => { const m = new StandardMaterial('rocket-glow', this.scene); m.emissiveColor = new Color3(1, 0.65, 0.3); m.disableLighting = true; return m; })();
      const body = MeshBuilder.CreateCylinder('rocket-body', { height: 0.5, diameter: 0.06, tessellation: 10 }, this.scene);
      const war = MeshBuilder.CreateCylinder('rocket-warhead', { height: 0.28, diameterTop: 0.02, diameterBottom: 0.085, tessellation: 12 }, this.scene);
      const glow = MeshBuilder.CreateSphere('rocket-exhaust', { diameter: 0.12, segments: 6 }, this.scene);
      for (const m of [body, war, glow]) { m.parent = root; m.rotation.x = Math.PI / 2; m.isPickable = false; }
      body.material = this.rocketMat; war.material = this.rocketMat; glow.material = this.glowMat;
      war.position.z = 0.38; glow.position.z = -0.27;
    } else {
      const g = MeshBuilder.CreateSphere('grenade', { diameter: 0.1, segments: 8 }, this.scene); g.parent = root; g.isPickable = false;
    }
    return root;
  }
  /** One model of each kind, so their shaders compile during loading. The caller disposes them. */
  warmUpModels() { return (['frag', 'smoke', 'rocket'] as const).map(k => { const m = this.model(k); m.position.set(0, -30, 0); return m; }); }
  launch(kind: ProjectileKind, position: Vector3, velocity: Vector3, player: boolean, owner?: number) {
    const mesh = this.model(kind);
    mesh.position.copyFrom(position);
    if (kind === 'rocket') mesh.lookAt(position.add(velocity));
    this.items.push({ mesh, velocity, age: 0, kind, player, owner, resting: false, spin: new Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
  }
  update(dt: number) {
    const remove = new Set<Projectile>();
    for (const p of this.items) {
      p.age += dt;
      if (p.age > 12) { remove.add(p); continue; }
      if (!p.resting) {
        if (p.kind !== 'rocket') p.velocity.y -= dt * 9.8;
        const distance = p.velocity.length() * dt, direction = p.velocity.normalizeToNew();
        const hit = this.scene.pickWithRay(new Ray(p.mesh.position, direction, distance + .08), m => !!m.metadata?.solid || (!!m.metadata?.enemy && m.metadata.enemy.alive && m.metadata.enemy.id !== p.owner));
        if (p.kind === 'rocket' && !p.player && this.playerPosition) {
          const player = this.playerPosition(), travel = p.velocity.scale(dt);
          for (const [center, radius] of [[player, .3], [player.subtract(new Vector3(0, .6, 0)), .5]] as [Vector3, number][]) {
            const t = Math.max(0, Math.min(1, Vector3.Dot(center.subtract(p.mesh.position), travel) / (travel.lengthSquared() || 1)));
            const point = p.mesh.position.add(travel.scale(t));
            if (Vector3.Distance(point, center) < radius && (!hit?.hit || distance * t < hit.distance)) {
              p.mesh.position.copyFrom(point); this.detonate(p); remove.add(p); break;
            }
          }
          if (remove.has(p)) continue;
        }
        const ground = p.mesh.position.y + p.velocity.y * dt < .06;
        if (hit?.hit || ground) {
          if (p.kind === 'rocket') { if (hit?.pickedPoint) p.mesh.position.copyFrom(hit.pickedPoint); this.detonate(p); remove.add(p); continue; }
          const speed = p.velocity.length();
          if (hit?.pickedPoint) { p.mesh.position.copyFrom(hit.pickedPoint).subtractInPlace(direction.scale(.08)); const normal = hit.getNormal(true) ?? Vector3.Up(); p.velocity.subtractInPlace(normal.scale(2 * Vector3.Dot(p.velocity, normal))).scaleInPlace(.45); }
          else { p.mesh.position.y = .06; p.velocity.y = Math.abs(p.velocity.y) * .32; p.velocity.x *= .62; p.velocity.z *= .62; }
          if (speed > 2) this.audio?.play('grenade_bounce', p.mesh.position, Math.min(1, speed / 8));
          p.spin.scaleInPlace(0.6);
          if (p.velocity.length() < 1) p.resting = true;
        } else p.mesh.position.addInPlace(p.velocity.scale(dt));
        if (p.kind === 'rocket') this.effects.trail(p.mesh.position.subtract(direction.scale(0.3)));
        else { p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt; p.mesh.rotation.z += p.spin.z * dt; }
      }
      if (p.kind !== 'rocket' && p.age >= RULES.grenadeFuse) { this.detonate(p); remove.add(p); }
    }
    for (const p of remove) p.mesh.dispose(); this.items = this.items.filter(p => !remove.has(p));
  }
  detonate(p: Projectile) {
    if (p.kind === 'smoke') { this.effects.smoke(p.mesh.position); this.audio?.play('barrel_ignite', p.mesh.position, .6, 1.4); }
    else this.onBlast?.(p.mesh.position.clone(), p.kind === 'rocket' ? RULES.rocketRadius : RULES.grenadeRadius, p.kind === 'rocket' ? RULES.rocketDamage : RULES.grenadeDamage, 'frag', p.player);
  }
}
