import {
  AbstractMesh, AnimationGroup, AssetContainer, Mesh, MeshBuilder, PBRMaterial, Scene, Texture, TransformNode, Vector3, type Material,
} from '../babylon';
import type { Point } from '../world/navigation';
export type EnemyKind = 'pistol' | 'rifle' | 'rocket' | 'bomber';
type Outfit = 'camo' | 'olive' | 'black' | 'desert';

/** Per-scene fighter source: the CC0 rigged model plus outfit colour variants. */
export class FighterTemplate {
  outfits = new Map<Outfit, Material>();
  constructor(public scene: Scene, public container: AssetContainer) {
    FighterTemplate.dropStaticChannels(container);
    const base = container.materials.find(m => m.name === 'M_Outfit') as PBRMaterial | undefined;
    if (base) {
      this.outfits.set('camo', base);
      for (const v of ['olive', 'black', 'desert'] as const) {
        const m = base.clone(`M_Outfit_${v}`);
        m.albedoTexture = new Texture(`${import.meta.env.BASE_URL}assets/models/outfit_${v}.jpg`, scene, { invertY: false });
        this.outfits.set(v, m);
      }
    }
  }
  /**
   * The exported clips key translation and scale on every bone even where they never change. Each
   * channel is cloned for every fighter and evaluated every frame, so drop the ones that only repeat
   * the bone's rest value: spawning gets cheaper and the pose is unchanged.
   */
  static dropStaticChannels(container: AssetContainer) {
    const done = container as AssetContainer & { staticChannelsDropped?: boolean };
    if (done.staticChannelsDropped) return;
    done.staticChannelsDropped = true;
    for (const group of container.animationGroups) {
      const keep = group.targetedAnimations.filter(({ animation, target }) => {
        const prop = animation.targetProperty;
        if (prop !== 'position' && prop !== 'scaling') return true;
        const rest = (target as TransformNode)[prop] as Vector3 | undefined;
        if (!rest) return true;
        return animation.getKeys().some(k => !(k.value as Vector3).equalsWithEpsilon(rest, 1e-4));
      });
      if (keep.length === group.targetedAnimations.length) continue;
      group.targetedAnimations.splice(0, group.targetedAnimations.length, ...keep);
    }
  }
}

const GEAR = ['AK47', 'EnemyPistol', 'RPG7', 'BomberVest', 'BomberLight', 'ChestPouches', 'Balaclava', 'FaceScarf', 'Hair'];
const CLIPS: Record<EnemyKind, string[]> = {
  rifle: ['Rifle_Idle', 'Rifle_AimIdle', 'Rifle_Walk', 'Rifle_AimWalk', 'Rifle_Run'],
  pistol: ['Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Walk', 'Pistol_Run', 'Pistol_Shoot'],
  rocket: ['RPG_Idle', 'RPG_Walk'],
  bomber: ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'],
};

export class Enemy {
  root: TransformNode;
  model: TransformNode;
  meshes: AbstractMesh[] = [];
  hitboxes: Mesh[] = [];
  head!: Mesh;
  body!: Mesh;
  muzzle?: TransformNode;
  bones = new Map<string, TransformNode>();
  groups = new Map<string, AnimationGroup>();
  private instance?: { skeletons: { dispose(): void }[] };
  private weights = new Map<string, number>();
  private target = '';
  private oneShot = '';
  private overlay = '';
  private overlayAge = 0;
  health = 3;
  alive = true;
  deathAge = 0;
  hitAge = 0;
  reaction = 0;
  fireCooldown = 1;
  grenadeCooldown = 15 + Math.random() * 12;
  shoutCooldown = 12 + Math.random() * 25;
  route: Point[] = [];
  repath = Math.random();
  walking = false;
  speed = 0;
  aiming = false;
  time = Math.random() * 10;
  throwAge = 0;
  recoil = 0;
  warn = 0;
  deathFloor = 0;
  yaw = 0;
  burst = 0;
  constructor(public scene: Scene, public kind: EnemyKind, position: Vector3, public id: number, template: FighterTemplate) {
    this.root = new TransformNode(`enemy-${id}`, scene);
    this.root.position.copyFrom(position);
    // outfit, face covering and kit
    const outfit: Outfit = kind === 'bomber' ? 'desert' : kind === 'rocket' ? 'black' : (['camo', 'olive', 'camo', 'black'] as Outfit[])[id % 4];
    const masked = kind === 'bomber' ? false : (id * 7) % 5 !== 0;
    const show = new Set<string>([masked ? 'Balaclava' : 'FaceScarf', ...(masked ? [] : ['Hair'])]);
    if (kind === 'rifle') { show.add('AK47'); show.add('ChestPouches'); }
    if (kind === 'pistol') show.add('EnemyPistol');
    if (kind === 'rocket') { show.add('RPG7'); show.add('ChestPouches'); }
    if (kind === 'bomber') { show.add('BomberVest'); show.add('BomberLight'); }
    const need = new Set(['Death01', 'Hit_Chest', 'Hit_Head', 'Hit_Knockback', 'OverhandThrow', ...CLIPS[kind]]);
    const gearOf = (name: string) => GEAR.find(g => name === g || name.startsWith(`${g}_primitive`) || name.startsWith(`${g}.`));
    // clone only this fighter's kit and the clips its role uses: spawning stays cheap
    const inst = this.instance = template.container.instantiateModelsToScene(n => `e${id}-${n}`, false, {
      doNotInstantiate: true,
      predicate: (o: { name: string }) => o instanceof AnimationGroup ? need.has(o.name) : !gearOf(o.name) || show.has(gearOf(o.name)!),
    });
    this.model = inst.rootNodes[0] as TransformNode;
    this.model.parent = this.root; this.model.setEnabled(true);
    const strip = (n: string) => n.replace(`e${id}-`, '');
    for (const g of inst.animationGroups) { g.stop(); this.groups.set(strip(g.name), g); }
    for (const n of this.model.getDescendants(false)) this.bones.set(strip(n.name), n as TransformNode);
    for (const m of this.model.getChildMeshes(false)) {
      const name = strip(m.name), gear = gearOf(name);
      if (gear && !show.has(gear)) { m.setEnabled(false); continue; }
      if (m.material?.name.startsWith('M_Outfit')) m.material = template.outfits.get(outfit) ?? m.material;
      m.isPickable = false; m.receiveShadows = true;
      this.meshes.push(m);
    }
    this.muzzle = this.bones.get(kind === 'rocket' ? 'RPG7_Muzzle' : kind === 'pistol' ? 'Pistol_Muzzle' : 'AK47_Muzzle');
    this.buildHitboxes();
    this.play(this.idleName(), true, 0);
  }
  get position() { return this.root.position; }
  /** Invisible hit volumes parented to bones; the head volume decides headshots. */
  private buildHitboxes() {
    this.model.computeWorldMatrix(true);
    for (const n of this.bones.values()) n.computeWorldMatrix(true);
    const at = (name: string) => this.bones.get(name)?.getAbsolutePosition().clone() ?? this.root.position.clone();
    const make = (name: string, bone: string, centre: Vector3, size: [number, number, number], zone: 'head' | 'body') => {
      const box = MeshBuilder.CreateBox(`hit-${name}`, { width: size[0], height: size[1], depth: size[2] }, this.scene);
      box.position.copyFrom(centre); box.isVisible = false; box.isPickable = true;
      box.metadata = { enemy: this, zone };
      const parent = this.bones.get(bone); if (parent) box.setParent(parent);
      this.hitboxes.push(box); return box;
    };
    const head = at('Head'), neck = at('neck_01'), pelvis = at('pelvis'), spine3 = at('spine_03');
    this.head = make('head', 'Head', head.add(new Vector3(0, 0.1, 0)), [0.24, 0.29, 0.27], 'head');
    this.body = make('chest', 'spine_03', Vector3.Lerp(spine3, neck, 0.35), [0.44, 0.42, 0.3], 'body');
    make('belly', 'spine_01', Vector3.Lerp(pelvis, spine3, 0.5), [0.38, 0.32, 0.27], 'body');
    for (const s of ['l', 'r']) {
      make(`thigh-${s}`, `thigh_${s}`, Vector3.Lerp(at(`thigh_${s}`), at(`calf_${s}`), 0.5), [0.17, 0.46, 0.18], 'body');
      make(`calf-${s}`, `calf_${s}`, Vector3.Lerp(at(`calf_${s}`), at(`foot_${s}`), 0.5), [0.14, 0.44, 0.15], 'body');
      const ua = at(`upperarm_${s}`), la = at(`lowerarm_${s}`);
      make(`arm-${s}`, `upperarm_${s}`, Vector3.Lerp(ua, la, 0.5), [Math.abs(la.x - ua.x) + 0.02, 0.12, 0.12], 'body');
    }
  }
  private idleName() {
    return this.kind === 'rifle' ? 'Rifle_Idle' : this.kind === 'pistol' ? 'Pistol_Idle_Loop' : this.kind === 'rocket' ? 'RPG_Idle' : 'Idle_Loop';
  }
  private locomotion() {
    if (this.speed > 2.6) return this.kind === 'bomber' ? 'Sprint_Loop' : this.kind === 'rocket' ? 'RPG_Walk' : this.kind === 'pistol' ? 'Pistol_Run' : 'Rifle_Run';
    if (this.kind === 'rifle') return this.aiming ? 'Rifle_AimWalk' : 'Rifle_Walk';
    return this.kind === 'pistol' ? 'Pistol_Walk' : this.kind === 'rocket' ? 'RPG_Walk' : 'Walk_Loop';
  }
  private stance() {
    if (!this.aiming) return this.idleName();
    return this.kind === 'rifle' ? 'Rifle_AimIdle' : this.kind === 'pistol' ? 'Pistol_Aim_Neutral' : this.kind === 'rocket' ? 'RPG_Idle' : 'Idle_Loop';
  }
  /** Cross-fade to an animation; weights settle in update(). */
  play(name: string, loop = true, fade = 0.22) {
    const g = this.groups.get(name); if (!g || this.target === name) return;
    this.target = name;
    if (!g.isPlaying) { g.start(loop, 1, g.from, g.to); g.setWeightForAllAnimatables(fade ? 0 : 1); this.weights.set(name, fade ? 0 : 1); }
    if (!fade) for (const [n] of this.weights) if (n !== name) { this.groups.get(n)?.stop(); this.weights.delete(n); }
  }
  /** One-shot action (shoot, throw, hit) that returns to the base state. */
  action(name: string, overlay = false) {
    const g = this.groups.get(name); if (!g) return;
    if (overlay) { this.overlay = name; this.overlayAge = 0; g.stop(); g.start(false, 1.15, g.from, g.to); g.setWeightForAllAnimatables(0.55); return; }
    this.oneShot = name; g.stop(); this.weights.set(name, 0); g.start(false, 1, g.from, g.to);
    g.onAnimationGroupEndObservable.addOnce(() => { if (this.oneShot === name) this.oneShot = ''; });
    this.target = name;
  }
  hit(head: boolean) { this.hitAge = .35; if (this.alive) this.action(head ? 'Hit_Head' : (Math.random() < .5 ? 'Hit_Chest' : 'Hit_Knockback'), true); }
  throwGrenade() { this.throwAge = .9; this.action('OverhandThrow'); }
  fire() {
    this.recoil = 1;
    if (this.kind === 'pistol' && !this.walking) this.action('Pistol_Shoot');
  }
  animate(dt: number) {
    this.time += dt; this.hitAge = Math.max(0, this.hitAge - dt); this.throwAge = Math.max(0, this.throwAge - dt); this.recoil = Math.max(0, this.recoil - dt * 7);
    if (!this.alive) { this.deathAge += dt; return; }
    if (!this.oneShot) {
      const want = this.walking ? this.locomotion() : this.stance();
      if (want !== this.target) this.play(want);
      const g = this.groups.get(this.target);
      if (g && this.walking) g.speedRatio = Math.max(0.7, Math.min(1.5, this.speed / (this.speed > 2.6 ? (this.kind === 'bomber' ? 4.6 : 3.1) : 1.45)));
      else if (g) g.speedRatio = 1;
    }
    // settle cross-fade weights, then normalise over clips that are still playing so the
    // blend never falls back towards the bind (T) pose when a one-shot clip finishes
    const k = Math.min(1, dt / 0.2);
    if (!this.weights.has(this.target)) { const g = this.groups.get(this.target); if (g) { if (!g.isPlaying) g.start(true, 1, g.from, g.to); this.weights.set(this.target, 0); } }
    for (const [n, w] of this.weights) {
      const g = this.groups.get(n);
      if (!g?.isPlaying && n !== this.target) { g?.stop(); this.weights.delete(n); continue; }
      const goal = n === this.target ? 1 : 0, nw = Math.max(0, Math.min(1, w + (goal - w) * k + (goal > w ? 0.002 : -0.002)));
      if (nw <= 0.001 && n !== this.target) { g?.stop(); this.weights.delete(n); continue; }
      this.weights.set(n, nw);
    }
    let total = 0;
    for (const [n, w] of this.weights) if (this.groups.get(n)?.isPlaying) total += w;
    if (total < 1e-3) { this.weights.set(this.target, 1); total = 1; }
    for (const [n, w] of this.weights) this.groups.get(n)?.setWeightForAllAnimatables(w / total);
    if (this.overlay) {
      this.overlayAge += dt; const g = this.groups.get(this.overlay);
      const w = Math.max(0, 0.55 * (1 - this.overlayAge / 0.55));
      g?.setWeightForAllAnimatables(w);
      if (w <= 0) { g?.stop(); this.overlay = ''; }
    }
  }
  die() {
    if (!this.alive) return;
    this.deathFloor = this.position.y; this.alive = false;
    for (const h of this.hitboxes) h.isPickable = false;
    if (this.overlay) { this.groups.get(this.overlay)?.stop(); this.overlay = ''; }
    for (const [n] of this.weights) { this.groups.get(n)?.stop(); }
    this.weights.clear(); this.oneShot = ''; this.target = 'Death01';
    const g = this.groups.get('Death01');
    if (g) { g.start(false, 0.9 + Math.random() * 0.25, g.from, g.to); g.setWeightForAllAnimatables(1); }
  }
  setBomberLight(on: boolean) {
    const light = [...this.model.getChildMeshes(false)].find(m => m.name.includes('BomberLight'));
    if (light) light.visibility = on ? 1 : 0.15;
  }
  dispose() {
    // AnimationGroup.dispose() does not stop its animatables, so stop first: otherwise every removed
    // fighter kept animating invisible bones, and the game slowed down with each kill.
    for (const g of this.groups.values()) { g.stop(); g.dispose(); }
    for (const sk of this.instance?.skeletons ?? []) sk.dispose();
    this.root.dispose(false, false);
  }
}
