import {
  Color3, Color4, Matrix, Mesh, MeshBuilder, ParticleSystem, PBRMaterial, PhysicsAggregate, PhysicsShapeType, PointLight, Quaternion, Scene,
  StandardMaterial, Vector3, type FreeCamera,
} from '../babylon';
import { RULES } from '../config/game';
import { segmentSphere } from '../logic/damage';
import type { FxTextures } from '../world/environment';
import type { Materials, Surface } from '../world/materials';

type Burst = { pos: Vector3; dir: Vector3; spread: number; radius: number; left: number };
/**
 * A single particle system that can emit many small bursts at different places in the same
 * frame: start position/direction callbacks read from a queue of pending bursts.
 */
class BurstSystem {
  ps: ParticleSystem;
  private queue: Burst[] = [];
  private current?: Burst;
  constructor(scene: Scene, name: string, capacity: number, setup: (ps: ParticleSystem) => void) {
    this.ps = new ParticleSystem(name, capacity, scene);
    this.ps.emitter = Vector3.Zero(); this.ps.emitRate = 0; this.ps.manualEmitCount = 0;
    setup(this.ps);
    this.ps.startPositionFunction = (_m: Matrix, pos: Vector3) => {
      while (this.queue.length && this.queue[0].left <= 0) this.queue.shift();
      const b = this.current = this.queue[0];
      if (!b) { pos.set(0, -100, 0); return; }
      pos.set(b.pos.x + (Math.random() - .5) * b.radius, b.pos.y + (Math.random() - .5) * b.radius, b.pos.z + (Math.random() - .5) * b.radius);
    };
    this.ps.startDirectionFunction = (_m: Matrix, dir: Vector3) => {
      const b = this.current; if (!b) { dir.set(0, 0, 0); return; }
      const s = b.spread;
      dir.set(b.dir.x + (Math.random() - .5) * s, b.dir.y + (Math.random() - .5) * s, b.dir.z + (Math.random() - .5) * s);
      b.left--;
    };
    this.ps.start();
  }
  emit(pos: Vector3, dir: Vector3, count: number, spread = 1, radius = 0.05) {
    if (count <= 0) return;
    this.queue.push({ pos: pos.clone(), dir: dir.clone(), spread, radius, left: count });
    if (this.queue.length > 64) this.queue.splice(0, this.queue.length - 64);
    this.ps.manualEmitCount = (this.ps.manualEmitCount < 0 ? 0 : this.ps.manualEmitCount) + count;
  }
}

export type Smoke = { position: Vector3; age: number; ps: ParticleSystem };
type Tracer = { mesh: Mesh; from: Vector3; dir: Vector3; length: number; travelled: number; speed: number; active: boolean };
type Shell = { mesh: Mesh; v: Vector3; age: number; floor: number; active: boolean };
type Debris = { mesh: Mesh; age: number; life: number; physics?: PhysicsAggregate };

export class Effects {
  clouds: Smoke[] = [];
  budgetScale = 1;
  onShake?: (amount: number, at: Vector3) => void;
  private bursts: Record<string, BurstSystem> = {};
  private tracers: Tracer[] = [];
  private shells: Shell[] = [];
  private holes: Mesh[] = [];
  private holeIndex = 0;
  private stains: Mesh[] = [];
  private stainIndex = 0;
  private scorches: Mesh[] = [];
  private scorchIndex = 0;
  private debris: Debris[] = [];
  // Lights are created once at load and reused. Adding or removing a light at runtime makes every
  // lit material recompile its shaders, which froze the game for up to a second per explosion.
  private lights: { light: PointLight; age: number; life: number; peak: number }[] = [];
  private fireLight?: PointLight;
  private fireLightUsed = false;
  constructor(public scene: Scene, public fx: FxTextures, public camera: FreeCamera, public mats?: Materials) {
    for (let i = 0; i < 2; i++) {
      const light = new PointLight(`blast-light-${i}`, new Vector3(0, -50, 0), scene);
      light.diffuse = new Color3(1, 0.55, 0.22); light.intensity = 0; light.range = 14;
      this.lights.push({ light, age: 1, life: 0.45, peak: 0 });
    }
    this.fireLight = new PointLight('barrel-fire-light', new Vector3(0, -50, 0), scene);
    this.fireLight.diffuse = new Color3(1, 0.5, 0.18); this.fireLight.intensity = 0; this.fireLight.range = 7;
    const add = (name: string, cap: number, setup: (ps: ParticleSystem) => void) => (this.bursts[name] = new BurstSystem(scene, name, cap, setup));
    add('dust', 260, ps => {
      ps.particleTexture = fx.get('smoke_08.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = new Color4(0.62, 0.55, 0.45, 0.55); ps.color2 = new Color4(0.5, 0.45, 0.38, 0.45); ps.colorDead = new Color4(0.5, 0.45, 0.4, 0);
      ps.minSize = 0.12; ps.maxSize = 0.32; ps.addSizeGradient(0, 0.25); ps.addSizeGradient(1, 1.1);
      ps.minLifeTime = 0.6; ps.maxLifeTime = 1.5; ps.minEmitPower = 0.5; ps.maxEmitPower = 1.6; ps.gravity = new Vector3(0, 0.15, 0);
      ps.minAngularSpeed = -1.5; ps.maxAngularSpeed = 1.5; ps.minInitialRotation = 0; ps.maxInitialRotation = 6;
    });
    add('chips', 200, ps => {
      ps.particleTexture = fx.get('dirt_01.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = new Color4(0.55, 0.5, 0.42, 1); ps.color2 = new Color4(0.35, 0.32, 0.28, 1); ps.colorDead = new Color4(0.3, 0.3, 0.3, 0);
      ps.minSize = 0.04; ps.maxSize = 0.1; ps.minLifeTime = 0.45; ps.maxLifeTime = 0.9; ps.minEmitPower = 2; ps.maxEmitPower = 5;
      ps.gravity = new Vector3(0, -9.8, 0); ps.minAngularSpeed = -8; ps.maxAngularSpeed = 8;
    });
    add('sparks', 200, ps => {
      ps.particleTexture = fx.get('spark.jpg'); ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.color1 = new Color4(1, 0.85, 0.5, 1); ps.color2 = new Color4(1, 0.6, 0.25, 1); ps.colorDead = new Color4(0.6, 0.2, 0, 0);
      ps.minSize = 0.05; ps.maxSize = 0.11; ps.minLifeTime = 0.12; ps.maxLifeTime = 0.35; ps.minEmitPower = 4; ps.maxEmitPower = 10;
      ps.gravity = new Vector3(0, -9.8, 0); ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    });
    add('blood', 120, ps => {
      ps.particleTexture = fx.get('smoke_07.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = new Color4(0.36, 0.03, 0.02, 0.85); ps.color2 = new Color4(0.24, 0.02, 0.01, 0.7); ps.colorDead = new Color4(0.2, 0.02, 0.01, 0);
      ps.minSize = 0.08; ps.maxSize = 0.2; ps.addSizeGradient(0, 0.12); ps.addSizeGradient(1, 0.45);
      ps.minLifeTime = 0.25; ps.maxLifeTime = 0.55; ps.minEmitPower = 0.6; ps.maxEmitPower = 2; ps.gravity = new Vector3(0, -3, 0);
    });
    add('flash', 40, ps => {
      ps.particleTexture = fx.get('scorch_02.jpg'); ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.color1 = new Color4(1, 0.8, 0.45, 1); ps.color2 = new Color4(1, 0.65, 0.3, 1); ps.colorDead = new Color4(1, 0.4, 0.1, 0);
      ps.minSize = 0.35; ps.maxSize = 0.6; ps.minLifeTime = 0.04; ps.maxLifeTime = 0.07; ps.minEmitPower = 0; ps.maxEmitPower = 0;
      ps.minInitialRotation = 0; ps.maxInitialRotation = 6.28;
    });
    add('blastflash', 12, ps => {
      ps.particleTexture = fx.get('scorch_03.jpg'); ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.color1 = new Color4(1, 0.78, 0.45, 1); ps.color2 = new Color4(1, 0.62, 0.3, 1); ps.colorDead = new Color4(1, 0.35, 0.1, 0);
      ps.minSize = 4; ps.maxSize = 6.5; ps.minLifeTime = 0.12; ps.maxLifeTime = 0.2; ps.minEmitPower = 0; ps.maxEmitPower = 0;
      ps.minInitialRotation = 0; ps.maxInitialRotation = 6.28;
    });
    add('fireball', 60, ps => {
      ps.particleTexture = fx.get('explosion_sheet.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.isAnimationSheetEnabled = true; ps.spriteCellWidth = 128; ps.spriteCellHeight = 128; ps.startSpriteCellID = 0; ps.endSpriteCellID = 8;
      ps.spriteCellChangeSpeed = 1; ps.spriteCellLoop = false; ps.spriteRandomStartCell = false;
      ps.color1 = new Color4(1, 1, 1, 1); ps.color2 = new Color4(1, 0.9, 0.8, 1); ps.colorDead = new Color4(0.4, 0.35, 0.3, 0);
      ps.minSize = 1.6; ps.maxSize = 3.2; ps.addSizeGradient(0, 1.2); ps.addSizeGradient(1, 2.6);
      ps.minLifeTime = 0.55; ps.maxLifeTime = 0.9; ps.minEmitPower = 1; ps.maxEmitPower = 4; ps.gravity = new Vector3(0, 2, 0);
      ps.minInitialRotation = 0; ps.maxInitialRotation = 6.28;
    });
    add('smoke', 160, ps => {
      ps.particleTexture = fx.get('smoke_04.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = new Color4(0.2, 0.19, 0.17, 0.7); ps.color2 = new Color4(0.32, 0.3, 0.27, 0.55); ps.colorDead = new Color4(0.45, 0.43, 0.4, 0);
      ps.minSize = 1.2; ps.maxSize = 2.4; ps.addSizeGradient(0, 1); ps.addSizeGradient(1, 4.2);
      ps.minLifeTime = 2.5; ps.maxLifeTime = 5; ps.minEmitPower = 0.6; ps.maxEmitPower = 2.6; ps.gravity = new Vector3(0.3, 0.9, 0.15);
      ps.minAngularSpeed = -0.6; ps.maxAngularSpeed = 0.6; ps.minInitialRotation = 0; ps.maxInitialRotation = 6.28;
    });
    add('debris', 160, ps => {
      ps.particleTexture = fx.get('dirt_02.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = new Color4(0.42, 0.38, 0.33, 1); ps.color2 = new Color4(0.2, 0.18, 0.16, 1); ps.colorDead = new Color4(0.2, 0.2, 0.2, 0);
      ps.minSize = 0.1; ps.maxSize = 0.3; ps.minLifeTime = 0.8; ps.maxLifeTime = 1.6; ps.minEmitPower = 4; ps.maxEmitPower = 11;
      ps.gravity = new Vector3(0, -9.8, 0); ps.minAngularSpeed = -6; ps.maxAngularSpeed = 6;
    });
    add('wisp', 80, ps => {
      ps.particleTexture = fx.get('smoke_01.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = new Color4(0.8, 0.78, 0.74, 0.18); ps.color2 = new Color4(0.7, 0.68, 0.64, 0.12); ps.colorDead = new Color4(0.7, 0.7, 0.7, 0);
      ps.minSize = 0.06; ps.maxSize = 0.12; ps.addSizeGradient(0, 0.08); ps.addSizeGradient(1, 0.5);
      ps.minLifeTime = 0.5; ps.maxLifeTime = 1.1; ps.minEmitPower = 0.2; ps.maxEmitPower = 0.6; ps.gravity = new Vector3(0, 0.5, 0);
    });
    add('trail', 220, ps => {
      ps.particleTexture = fx.get('smoke_07.png'); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = new Color4(0.62, 0.6, 0.57, 0.6); ps.color2 = new Color4(0.5, 0.48, 0.45, 0.5); ps.colorDead = new Color4(0.6, 0.6, 0.6, 0);
      ps.minSize = 0.25; ps.maxSize = 0.4; ps.addSizeGradient(0, 0.3); ps.addSizeGradient(1, 1.6);
      ps.minLifeTime = 1.0; ps.maxLifeTime = 1.8; ps.minEmitPower = 0.1; ps.maxEmitPower = 0.4; ps.gravity = new Vector3(0, 0.25, 0);
    });
    // textures used by effects created mid-game; load them now so the first use is instant
    for (const t of ['fire_01.jpg', 'smoke_07.png', 'smoke_01.png', 'scorch_decal.png', 'splat_03.png']) fx.get(t);
    // tracer, decal and casing pools
    const tracerMat = new StandardMaterial('tracer-mat', scene);
    tracerMat.diffuseTexture = fx.get('trace_01.jpg'); tracerMat.emissiveColor = new Color3(1, 0.82, 0.5); tracerMat.disableLighting = true;
    tracerMat.opacityTexture = fx.get('trace_01.jpg'); tracerMat.alphaMode = 1; tracerMat.backFaceCulling = false; tracerMat.fogEnabled = false;
    for (let i = 0; i < 24; i++) {
      const m = MeshBuilder.CreatePlane('tracer', { width: 0.045, height: 1 }, scene);
      m.material = tracerMat; m.isPickable = false; m.setEnabled(false); m.rotationQuaternion = new Quaternion();
      this.tracers.push({ mesh: m, from: new Vector3(), dir: new Vector3(), length: 0, travelled: 0, speed: 0, active: false });
    }
    const holeMat = new PBRMaterial('bullet-hole-mat', scene);
    holeMat.albedoTexture = fx.get('bullet_hole.png'); holeMat.albedoTexture.hasAlpha = true; holeMat.useAlphaFromAlbedoTexture = true;
    holeMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND; holeMat.roughness = 1; holeMat.metallic = 0; holeMat.zOffset = -3;
    for (let i = 0; i < 90; i++) {
      const m = MeshBuilder.CreatePlane('bullet-hole', { size: 0.11 }, scene); m.material = holeMat; m.isPickable = false; m.setEnabled(false);
      this.holes.push(m);
    }
    const stainMat = new PBRMaterial('stain-mat', scene);
    stainMat.albedoTexture = fx.get('splat_03.png'); stainMat.albedoTexture.hasAlpha = true; stainMat.useAlphaFromAlbedoTexture = true;
    stainMat.albedoColor = new Color3(0.22, 0.02, 0.015); stainMat.alpha = 0.85; stainMat.roughness = 0.35; stainMat.metallic = 0; stainMat.zOffset = -2;
    for (let i = 0; i < 16; i++) {
      const m = MeshBuilder.CreateGround('blood-stain', { width: 1, height: 1 }, scene); m.material = stainMat; m.isPickable = false; m.setEnabled(false);
      this.stains.push(m);
    }
    const scorchMat = new PBRMaterial('scorch-mat', scene);
    scorchMat.albedoTexture = fx.get('scorch_decal.png'); scorchMat.albedoTexture.hasAlpha = true; scorchMat.useAlphaFromAlbedoTexture = true;
    scorchMat.roughness = 1; scorchMat.metallic = 0; scorchMat.zOffset = -2;
    for (let i = 0; i < 10; i++) {
      const m = MeshBuilder.CreateGround('scorch', { width: 1, height: 1 }, scene); m.material = scorchMat; m.isPickable = false; m.setEnabled(false);
      this.scorches.push(m);
    }
    const brass = new PBRMaterial('brass', scene); brass.albedoColor = new Color3(0.55, 0.38, 0.14); brass.metallic = 1; brass.roughness = 0.5;
    for (let i = 0; i < 28; i++) {
      const m = MeshBuilder.CreateCylinder('casing', { diameter: 0.008, height: 0.03, tessellation: 6 }, scene); m.material = brass; m.isPickable = false; m.setEnabled(false);
      this.shells.push({ mesh: m, v: new Vector3(), age: 0, floor: 0, active: false });
    }
  }
  private n(count: number) { return Math.max(1, Math.round(count * this.budgetScale)); }
  /** Show one of each pooled mesh, plus debris, so their shaders compile during loading. Returns the undo. */
  warmUp() {
    const shown = [this.holes[0], this.stains[0], this.scorches[0], this.tracers[0].mesh, this.shells[0].mesh];
    for (const m of shown) { m.setEnabled(true); m.position.set(0, -30, 0); }
    const debris = (['planks', 'redMetal'] as const).map(id => {
      const m = MeshBuilder.CreateBox('debris-warmup', { size: 0.1 }, this.scene); m.position.set(0, -30, 0);
      if (this.mats) m.material = this.mats.get(id); m.receiveShadows = true; m.isPickable = false; return m;
    });
    return () => { for (const m of shown) m.setEnabled(false); for (const m of debris) m.dispose(); };
  }
  /** Bullet strike on a surface. */
  impact(p: Vector3, surface: Surface | 'flesh' = 'concrete', normal?: Vector3) {
    const nrm = normal ?? Vector3.Up();
    if (surface === 'flesh') { this.bursts.blood.emit(p, nrm.scale(0.6), this.n(7), 1.4, 0.06); return; }
    const tint = surface === 'wood' ? 0.8 : surface === 'dirt' ? 1.05 : 1;
    this.bursts.dust.ps.color1.set(0.62 * tint, 0.55 * tint, 0.45 * tint, 0.55);
    this.bursts.dust.emit(p.add(nrm.scale(0.05)), nrm.scale(0.8), this.n(surface === 'metal' ? 2 : 5), 1.2, 0.05);
    if (surface !== 'fabric') this.bursts.chips.emit(p, nrm, this.n(surface === 'metal' ? 2 : 6), 1.8, 0.02);
    if (surface === 'metal') this.bursts.sparks.emit(p, nrm.scale(0.8), this.n(9), 1.6, 0.01);
  }
  /** Enemy (third-person) muzzle flash. */
  muzzle(p: Vector3) { this.bursts.flash.emit(p, Vector3.Zero(), 1, 0, 0); }
  trail(p: Vector3) { this.bursts.trail.emit(p, Vector3.Zero(), 1, 0.4, 0.05); }
  muzzleSmoke(p: Vector3, dir: Vector3) { this.bursts.wisp.emit(p, dir.scale(0.5), this.n(2), 0.5, 0.02); }
  tracer(a: Vector3, b: Vector3, speed = 320) {
    const t = this.tracers.find(t => !t.active) ?? this.tracers[0];
    const delta = b.subtract(a), length = delta.length(); if (length < 1.5) return;
    t.from.copyFrom(a); t.dir.copyFrom(delta.scale(1 / length)); t.length = length; t.travelled = 0; t.speed = speed; t.active = true;
    t.mesh.setEnabled(true);
  }
  decal(p: Vector3, normal: Vector3) {
    const m = this.holes[this.holeIndex++ % this.holes.length];
    m.setEnabled(true); m.position.copyFrom(p).addInPlace(normal.scale(0.01));
    m.lookAt(p.subtract(normal)); m.rotate(Vector3.Forward(), Math.random() * 6.28);
  }
  bloodPool(p: Vector3) {
    const m = this.stains[this.stainIndex++ % this.stains.length];
    m.setEnabled(true); m.position.set(p.x + (Math.random() - .5) * 0.4, p.y + 0.03, p.z + (Math.random() - .5) * 0.4);
    m.rotation.y = Math.random() * 6.28; const s = 0.9 + Math.random() * 0.6; m.scaling.set(s, 1, s);
  }
  scorch(p: Vector3, size: number) {
    const m = this.scorches[this.scorchIndex++ % this.scorches.length];
    m.setEnabled(true); m.position.set(p.x, p.y + 0.04, p.z); m.rotation.y = Math.random() * 6.28; m.scaling.set(size, 1, size);
  }
  shell(at: Vector3, right: Vector3, floor: number) {
    if (this.budgetScale < 0.5) return;
    const s = this.shells.find(s => !s.active) ?? this.shells[0];
    s.active = true; s.age = 0; s.floor = floor; s.mesh.setEnabled(true); s.mesh.position.copyFrom(at);
    s.v.copyFrom(right.scale(1.8 + Math.random())).addInPlace(new Vector3((Math.random() - .5) * .5, 1.6 + Math.random(), (Math.random() - .5) * .5));
  }
  explosion(p: Vector3, scale = 1) {
    this.bursts.fireball.emit(p.add(new Vector3(0, 0.4 * scale, 0)), new Vector3(0, 0.6, 0), this.n(7 * scale), 2.2, 0.8 * scale);
    this.bursts.smoke.emit(p.add(new Vector3(0, 0.8, 0)), new Vector3(0, 0.8, 0), this.n(10 * scale), 1.6, 1.2 * scale);
    this.bursts.debris.emit(p.add(new Vector3(0, 0.2, 0)), new Vector3(0, 1, 0), this.n(18 * scale), 2.2, 0.4);
    this.bursts.sparks.emit(p.add(new Vector3(0, 0.3, 0)), new Vector3(0, 1, 0), this.n(20), 2.4, 0.3);
    this.bursts.dust.emit(p, new Vector3(0, 0.3, 0), this.n(14), 3, 1.5 * scale);
    this.bursts.blastflash.emit(p.add(new Vector3(0, 0.7 * scale, 0)), Vector3.Zero(), 2, 0, 0.3);
    if (this.budgetScale > 0.4) {
      const slot = this.lights.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
      slot.light.position.copyFrom(p).addInPlace(new Vector3(0, 1.2, 0)); slot.light.range = 14 * scale;
      slot.age = 0; slot.peak = 30 * scale;
    }
    this.onShake?.(scale, p);
  }
  /** Splintered crate or torn barrel pieces with Havok physics. */
  fragments(p: Vector3, kind: 'crate' | 'barrel') {
    const mat = this.mats ? this.mats.get(kind === 'crate' ? 'planks' : 'redMetal') : null;
    const count = Math.ceil((kind === 'crate' ? 7 : 5) * this.budgetScale);
    for (let i = 0; i < count && this.debris.length < 40; i++) {
      const m = kind === 'crate'
        ? MeshBuilder.CreateBox('debris', { width: 0.08 + Math.random() * 0.1, height: 0.04, depth: 0.4 + Math.random() * 0.5 }, this.scene)
        : MeshBuilder.CreateBox('debris', { width: 0.25 + Math.random() * 0.2, height: 0.02, depth: 0.2 + Math.random() * 0.3 }, this.scene);
      m.position.copyFrom(p).addInPlace(new Vector3(Math.random() - .5, 0.3 + Math.random() * 0.6, Math.random() - .5));
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      if (mat) m.material = mat; m.isPickable = false; m.receiveShadows = true;
      const physics = this.scene.isPhysicsEnabled() ? new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0.4, restitution: 0.25, friction: 0.8 }, this.scene) : undefined;
      physics?.body.applyImpulse(new Vector3((Math.random() - .5) * 3, 2 + Math.random() * 2.5, (Math.random() - .5) * 3), m.position);
      this.debris.push({ mesh: m, physics, age: 0, life: 14 });
    }
  }
  /** Burning fuel drum: flames and smoke until stopped. */
  burn(p: Vector3) {
    const flames = new ParticleSystem('barrel-fire', 50, this.scene);
    flames.particleTexture = this.fx.get('fire_01.jpg'); flames.emitter = p.add(new Vector3(0, 0.9, 0));
    flames.minEmitBox = new Vector3(-0.15, 0, -0.15); flames.maxEmitBox = new Vector3(0.15, 0.05, 0.15);
    flames.color1 = new Color4(1, 0.6, 0.2, 1); flames.color2 = new Color4(1, 0.4, 0.1, 1); flames.colorDead = new Color4(0.2, 0.05, 0, 0);
    flames.minSize = 0.45; flames.maxSize = 0.95; flames.minLifeTime = 0.3; flames.maxLifeTime = 0.6; flames.emitRate = 80;
    flames.blendMode = ParticleSystem.BLENDMODE_ADD; flames.direction1 = new Vector3(-0.2, 1, -0.2); flames.direction2 = new Vector3(0.2, 1.5, 0.2);
    flames.minEmitPower = 1; flames.maxEmitPower = 2; flames.gravity = new Vector3(0, 2, 0);
    flames.start();
    const smoke = new ParticleSystem('barrel-smoke', 30, this.scene);
    smoke.particleTexture = this.fx.get('smoke_07.png'); smoke.emitter = p.add(new Vector3(0, 1.3, 0));
    smoke.color1 = new Color4(0.1, 0.09, 0.08, 0.5); smoke.color2 = new Color4(0.15, 0.14, 0.13, 0.4); smoke.colorDead = new Color4(0.3, 0.3, 0.3, 0);
    smoke.minSize = 0.5; smoke.maxSize = 0.9; smoke.addSizeGradient(0, 0.5); smoke.addSizeGradient(1, 2.5);
    smoke.minLifeTime = 1.2; smoke.maxLifeTime = 2; smoke.emitRate = 14; smoke.direction1 = new Vector3(-0.2, 1, -0.2); smoke.direction2 = new Vector3(0.2, 1, 0.2);
    smoke.minEmitPower = 1; smoke.maxEmitPower = 1.8; smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    smoke.start();
    const light = this.budgetScale > 0.6 && !this.fireLightUsed ? this.fireLight : undefined;
    if (light) { this.fireLightUsed = true; light.position.copyFrom(p).addInPlace(new Vector3(0, 1.4, 0)); light.intensity = 4; }
    return { stop: () => { flames.stop(); smoke.stop(); if (light) { light.intensity = 0; this.fireLightUsed = false; } setTimeout(() => { if (!this.scene.isDisposed) { flames.dispose(); smoke.dispose(); } }, 2500); } };
  }
  /** Tactical smoke cloud. The logical cloud drives AI concealment; particles draw it. */
  smoke(p: Vector3) {
    const ps = new ParticleSystem('smoke-grenade', Math.ceil(170 * Math.max(0.5, this.budgetScale)), this.scene);
    ps.particleTexture = this.fx.get('smoke_01.png'); ps.emitter = p.add(new Vector3(0, 0.3, 0));
    ps.minEmitBox = new Vector3(-0.3, 0, -0.3); ps.maxEmitBox = new Vector3(0.3, 0.2, 0.3);
    ps.color1 = new Color4(0.84, 0.84, 0.82, 0.58); ps.color2 = new Color4(0.74, 0.74, 0.72, 0.5); ps.colorDead = new Color4(0.8, 0.8, 0.8, 0);
    ps.minSize = 2.2; ps.maxSize = 3.6; ps.addSizeGradient(0, 1.2); ps.addSizeGradient(0.3, 4.5); ps.addSizeGradient(1, 7);
    ps.minLifeTime = 7; ps.maxLifeTime = 11; ps.emitRate = 20;
    ps.direction1 = new Vector3(-1, 0.25, -1); ps.direction2 = new Vector3(1, 0.7, 1); ps.minEmitPower = 0.8; ps.maxEmitPower = 2.2;
    ps.gravity = new Vector3(0.05, 0.06, 0.03); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.minAngularSpeed = -0.3; ps.maxAngularSpeed = 0.3; ps.minInitialRotation = 0; ps.maxInitialRotation = 6.28;
    ps.targetStopDuration = RULES.smokeSeconds - 8; ps.start();
    this.clouds.push({ position: p.clone(), age: 0, ps });
  }
  obscured(a: Vector3, b: Vector3) { return this.clouds.some(s => s.age > 1 && s.age < RULES.smokeSeconds - 3 && segmentSphere(a.x, a.z, b.x, b.z, s.position.x, s.position.z, RULES.smokeRadius)); }
  density(p: Vector3) { return this.clouds.reduce((n, s) => Math.max(n, Math.max(0, 1 - Vector3.Distance(p, s.position) / RULES.smokeRadius) * Math.min(1, s.age / 2, (RULES.smokeSeconds - s.age) / 4)), 0); }
  update(dt: number) {
    for (const l of this.lights) {
      l.age = Math.min(l.age + dt, l.life); const t = l.age / l.life;
      l.light.intensity = l.peak * (t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88));
    }
    const cam = this.camera.globalPosition;
    for (const t of this.tracers) if (t.active) {
      t.travelled += t.speed * dt;
      const seg = Math.min(6, t.length * 0.5);
      if (t.travelled - seg > t.length) { t.active = false; t.mesh.setEnabled(false); continue; }
      const head = Math.min(t.length, t.travelled), tail = Math.max(0, head - seg);
      const mid = t.from.add(t.dir.scale((head + tail) / 2));
      t.mesh.position.copyFrom(mid); t.mesh.scaling.y = Math.max(0.05, head - tail);
      const view = cam.subtract(mid); const right = Vector3.Cross(t.dir, view).normalize(); const fwd = Vector3.Cross(right, t.dir).normalize();
      Quaternion.FromLookDirectionLHToRef(fwd, t.dir, t.mesh.rotationQuaternion!);
      // FromLookDirection aligns Z with fwd and Y with up (dir)
    }
    for (const s of this.shells) if (s.active) {
      s.age += dt; s.v.y -= 9.8 * dt; s.mesh.position.addInPlace(s.v.scale(dt)); s.mesh.rotation.x += dt * 20; s.mesh.rotation.z += dt * 13;
      if (s.mesh.position.y < s.floor + 0.01) { s.mesh.position.y = s.floor + 0.01; s.v.y = Math.abs(s.v.y) * 0.3; s.v.x *= 0.5; s.v.z *= 0.5; }
      if (s.age > 1.1) { s.active = false; s.mesh.setEnabled(false); }
    }
    for (const d of this.debris) { d.age += dt; if (d.age > d.life) { d.physics?.dispose(); d.mesh.dispose(); } }
    this.debris = this.debris.filter(d => d.age <= d.life);
    for (const s of this.clouds) {
      s.age += dt;
      if (s.age >= RULES.smokeSeconds) { s.ps.stop(); const ps = s.ps; setTimeout(() => { if (!this.scene.isDisposed) ps.dispose(); }, 12000); }
    }
    this.clouds = this.clouds.filter(s => s.age < RULES.smokeSeconds);
  }
}
