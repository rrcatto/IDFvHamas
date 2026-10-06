import { Vector3 } from '../babylon';
import { DIFFICULTIES, RULES, type KillSource } from '../config/game';
import { Session } from '../logic/session';
import { enemyHit } from '../logic/damage';
import { BattleMap } from '../world/map';
import { Player } from './player';
import { Enemy, FighterTemplate, type EnemyKind } from './enemy';
import { Projectiles } from './projectiles';
import { Effects } from '../effects/effects';
import { GameAudio } from '../audio';

export class EnemyManager {
  enemies: Enemy[] = [];
  serial = 0;
  time = 0;
  onPlayerDamage?: (amount: number, origin: Vector3, explosion: boolean) => void;
  onKill?: (enemy: Enemy, source: KillSource, head: boolean) => void;
  onExplosion?: (p: Vector3, radius: number, damage: number, source: KillSource, credited: boolean) => void;
  constructor(public map: BattleMap, public session: Session, public player: Player, public projectiles: Projectiles, public effects: Effects, public audio: GameAudio, public template: FighterTemplate) {}
  /** Line of sight against the collision world (walls, floors, cover). */
  visible(a: Vector3, b: Vector3) {
    return !this.map.nav.blocked(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  spawn(kind?: EnemyKind) {
    const p = this.player.camera.position;
    const candidates = this.map.enemySpawns.map(s => {
      const position = new Vector3(s.x, s.y ?? 0, s.z), distance = Vector3.Distance(position, p);
      const seen = this.visible(p, position.add(new Vector3(0, 1.6, 0))) && Vector3.Dot(this.player.forward(), position.subtract(p).normalize()) > .45;
      const crowded = this.enemies.some(e => e.alive && Vector3.Distance(e.position, position) < 2);
      return { position, score: distance + (seen ? -40 : 25) + Math.random() * 22 - (crowded ? 80 : 0), distance };
    }).filter(c => c.distance > 16).sort((a, b) => b.score - a.score);
    if (!candidates.length) return;
    const id = this.serial++;
    // Bombers spawn only at distant ground-level points so they cannot appear beside the player.
    let type: EnemyKind = kind ?? (this.session.wave === 0 ? 'pistol' : this.session.wave === 1 ? (id % 5 === 4 ? 'pistol' : 'rifle') : id % 7 === 1 ? 'rocket' : id % 7 === 3 ? 'bomber' : 'rifle');
    let spot = candidates[0];
    if (type === 'bomber') {
      const far = candidates.find(c => c.distance > 24 && c.position.y < 0.5);
      if (far) spot = far; else if (!kind) type = 'rifle';
    }
    if (type === 'rocket' && !kind) {
      const high = candidates.find(c => c.position.y > 3 && c.distance > 18);
      if (high) spot = high;
    }
    const enemy = new Enemy(this.map.scene, type, spot.position, id, this.template);
    enemy.yaw = Math.atan2(p.x - spot.position.x, p.z - spot.position.z); enemy.root.rotation.y = enemy.yaw;
    for (const m of enemy.meshes) this.map.env.caster(m, false);
    this.enemies.push(enemy); return enemy;
  }
  populate() { for (let i = 0; i < 5 + this.session.wave; i++) this.spawn(); }
  hit(enemy: Enemy, head: boolean, source: KillSource, melee = false, at?: Vector3) {
    if (!enemy.alive || !this.session.active) return;
    enemy.health = enemyHit(enemy.health, head, melee);
    enemy.hit(head);
    this.effects.impact(at ?? enemy.position.add(new Vector3(0, head ? 1.65 : 1.2, 0)), 'flesh', this.player.camera.position.subtract(enemy.position).normalize());
    this.audio.play('impact_flesh_*', enemy.position, .8);
    if (enemy.health <= 0) this.kill(enemy, source, true, head);
    else if (Math.random() < 0.7) this.audio.play('enemy_pain_*', enemy.position, .8, .94 + Math.random() * .12);
  }
  kill(enemy: Enemy, source: KillSource, credited: boolean, head = false) {
    if (!enemy.alive) return;
    enemy.die(); this.session.enemyDied();
    this.audio.play('enemy_death_*', enemy.position, .85, .95 + Math.random() * .1);
    this.effects.bloodPool(enemy.position.add(new Vector3(0, 0, 0)));
    if (credited) { this.session.stats.kill(source, head, enemy.kind === 'bomber'); this.onKill?.(enemy, source, head); }
  }
  private muzzlePoint(e: Enemy) {
    if (!e.muzzle) return e.position.add(new Vector3(0, 1.45, 0));
    // refresh the bone chain so a moved actor never fires from a stale position
    const chain: { computeWorldMatrix: (force?: boolean) => unknown }[] = [];
    for (let n: { parent: unknown } | null = e.muzzle; n; n = (n.parent as { parent: unknown } | null)) chain.unshift(n as never);
    for (const n of chain) n.computeWorldMatrix(true);
    const p = e.muzzle.getAbsolutePosition().clone();
    // fall back to the chest if the weapon hand is buried in a wall
    return Vector3.Distance(p, e.position) < 2.2 ? p : e.position.add(new Vector3(0, 1.45, 0));
  }
  update(dt: number) {
    this.time += dt;
    const d = DIFFICULTIES[this.session.difficulty], p = this.player.camera.position;
    const blink = Math.sin(this.time * 9) > 0;
    for (const e of this.enemies) {
      e.animate(dt); if (!e.alive) continue;
      const eye = e.position.add(new Vector3(0, 1.58, 0)), delta = p.subtract(eye), distance = delta.length();
      const smoke = this.effects.obscured(eye, p), los = !smoke && this.visible(eye, p);
      e.reaction = los ? e.reaction + dt : Math.max(0, e.reaction - dt * 2);
      e.repath -= dt; e.fireCooldown -= dt; e.grenadeCooldown -= dt; e.shoutCooldown -= dt;
      const range = e.kind === 'pistol' ? 15 : e.kind === 'rocket' ? 30 : 22;
      const wantsMove = (!los || distance > range || e.kind === 'bomber' || Math.sin(e.time * .35 + e.id) > .72) && e.throwAge <= 0;
      if (e.repath <= 0 && wantsMove) {
        let target = { x: p.x, z: p.z, y: this.player.feet };
        if (los && distance < range && e.kind !== 'bomber') target = { x: Math.max(-32, Math.min(32, p.x + Math.cos(e.id * 3) * 9)), z: Math.max(-32, Math.min(32, p.z + Math.sin(e.id * 3) * 9)), y: this.player.feet };
        e.route = this.map.nav.path({ x: e.position.x, z: e.position.z, y: e.position.y }, target); e.repath = 1.5 + Math.random();
      }
      e.walking = false; e.speed = 0;
      let moveYaw = e.yaw;
      if (wantsMove && e.route.length) {
        const target = e.route[0], dx = target.x - e.position.x, dz = target.z - e.position.z, norm = Math.hypot(dx, dz);
        if (norm < .22) e.route.shift();
        else {
          const speed = (e.kind === 'bomber' ? (distance < 18 && los ? 5.2 : 3.8) : los ? 1.55 : 2.9) * d.aggression;
          this.map.nav.move(e.position, dx / norm * dt * speed, dz / norm * dt * speed, e.position.y, .28);
          e.position.y = this.map.nav.ground(e.position.x, e.position.z, e.position.y); e.walking = true; e.speed = speed;
          moveYaw = Math.atan2(dx, dz);
        }
      }
      e.aiming = los && e.reaction > d.reaction * 0.5 && e.kind !== 'bomber';
      const goalYaw = e.aiming || !e.walking ? Math.atan2(delta.x, delta.z) : moveYaw;
      let diff = goalYaw - e.yaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      e.yaw += diff * Math.min(1, dt * 8); e.root.rotation.y = e.yaw;
      if (e.kind === 'bomber') e.setBomberLight(blink);
      if (this.session.state !== 'Playing') continue;
      if (e.kind === 'bomber') {
        if (distance < 3.4 && los) {
          e.warn += dt;
          if (e.warn < dt * 1.1) this.audio.play('enemy_shout_*', e.position, 1.1, 1.08);
          if (Math.floor(e.warn * 6) !== Math.floor((e.warn - dt) * 6)) this.audio.play('bomber_beep', e.position, 1.2, 1 + e.warn * .3);
          if (e.warn > 1.0) { this.kill(e, 'frag', false); this.onExplosion?.(e.position.clone(), RULES.bomberRadius, RULES.bomberDamage, 'frag', false); }
        } else {
          e.warn = Math.max(0, e.warn - dt * .5);
          if (Math.floor(this.time * 1.5 + e.id) !== Math.floor((this.time - dt) * 1.5 + e.id) && distance < 30) this.audio.play('bomber_beep', e.position, .45);
        }
        continue;
      }
      if (los && e.reaction > d.reaction && e.fireCooldown <= 0 && distance < 48 && e.throwAge <= 0) {
        const muzzle = this.muzzlePoint(e);
        e.fire();
        if (e.kind === 'rocket') {
          const aim = p.add(new Vector3((Math.random() - .5) * 1.2, -0.4, (Math.random() - .5) * 1.2));
          const direction = aim.subtract(muzzle).normalize();
          this.projectiles.launch('rocket', muzzle.add(direction.scale(.3)), direction.scale(24), false, e.id);
          this.audio.play('rocket_launch', e.position, 1); this.effects.muzzle(muzzle);
          for (let i = 0; i < 6; i++) this.effects.trail(muzzle.subtract(direction.scale(0.8 + i * 0.25)));
          e.fireCooldown = 8 * d.cadence;
        } else {
          const far = distance > 22;
          this.audio.play(e.kind === 'pistol' ? (far ? 'epistol_far_*' : 'epistol_near_*') : (far ? 'ak_far_*' : 'ak_near_*'), e.position, far ? .9 : .7, .96 + Math.random() * .08);
          this.effects.muzzle(muzzle);
          const accuracy = d.accuracy * Math.max(.35, 1 - distance / 65) * (this.player.moving ? .7 : 1) * (this.player.keys.has('ShiftLeft') ? .65 : 1) * (this.player.crouched ? .85 : 1) * (e.kind === 'rifle' ? 0.62 : 1);
          const hit = Math.random() < accuracy;
          const miss = hit ? Vector3.Zero() : new Vector3((Math.random() - .5) * 2.4, (Math.random() - .3) * 1.6, (Math.random() - .5) * 2.4);
          this.effects.tracer(muzzle, p.add(miss).add(p.subtract(muzzle).normalize().scale(hit ? -0.3 : 8)), 260);
          if (hit) this.onPlayerDamage?.((e.kind === 'pistol' ? 90 : 125) * d.damage, e.position, false);
          else if (distance > 6 && Math.random() < .45) this.audio.play('bullet_whiz_*', p.add(miss.scale(.4)), .55, .9 + Math.random() * .3);
          if (e.kind === 'rifle') {
            if (e.burst <= 0) e.burst = 2 + Math.floor(Math.random() * 3);
            e.burst--;
            e.fireCooldown = e.burst > 0 ? .11 + Math.random() * .03 : (0.75 + Math.random() * .8) * d.cadence;
          } else e.fireCooldown = 1.15 * d.cadence * (.85 + Math.random() * .5);
        }
      }
      if (los && distance > 6 && distance < 25 && e.grenadeCooldown <= 0) {
        const duration = Math.max(.7, distance / 12), v = p.subtract(eye).scale(1 / duration); v.y = 4.9 * duration + (p.y - eye.y) / duration;
        this.projectiles.launch('frag', eye.add(delta.normalizeToNew().scale(.7)), v, false, e.id); e.grenadeCooldown = d.grenadeInterval * (.8 + Math.random() * .5);
        e.throwGrenade(); this.audio.play('enemy_throw', eye, .7); this.audio.play('grenade_throw', eye, .5);
      }
      if (los && e.shoutCooldown <= 0) { this.audio.play('enemy_shout_*', e.position, .8, .95 + Math.random() * .1); e.shoutCooldown = 20 + Math.random() * 20; }
    }
    for (const e of this.enemies) if (!e.alive && e.deathAge > RULES.corpseSeconds) e.dispose();
    this.enemies = this.enemies.filter(e => e.alive || e.deathAge <= RULES.corpseSeconds);
    for (let n = this.session.takeReplacements(); n > 0; n--) this.spawn();
  }
  safePlayerSpawn() {
    return [...this.map.playerSpawns].sort((a, b) => {
      const distance = (p: { x: number; z: number }) => Math.min(...this.enemies.filter(e => e.alive).map(e => Math.hypot(e.position.x - p.x, e.position.z - p.z)), 100);
      return distance(b) - distance(a);
    })[0];
  }
}
