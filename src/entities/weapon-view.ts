import { AbstractMesh, AssetContainer, Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3, type Node } from '../babylon';
import type { Weapon } from '../config/game';
import type { FxTextures } from '../world/environment';

type Pose = { hip: Vector3; hipRot: Vector3; ads: Vector3; root: TransformNode };
/** Hip offsets in camera space (metres). ADS is the authored eye-space pose (front sight centred). */
const HIP: Record<Weapon, [number, number, number, number, number, number]> = {
  rifle: [0.15, -0.025, -0.03, 0.03, -0.1, -0.02], pistol: [0.1, -0.03, 0.0, 0.02, -0.08, -0.03],
  knife: [0.04, 0.065, -0.02, 0.1, -0.15, 0.2], frag: [0.0, 0.08, 0, 0, 0, 0], smoke: [0.0, 0.08, 0, 0, 0, 0],
};

export class WeaponView {
  root: TransformNode;
  holder: TransformNode;
  poses = new Map<Weapon, Pose>();
  recoil = 0;
  swayX = 0;
  swayY = 0;
  switchTime = 0;
  swingTime = 0;
  throwTime = 0;
  current: Weapon = 'rifle';
  muzzles = new Map<Weapon, TransformNode>();
  eject?: TransformNode;
  private flashes: Mesh[] = [];
  private pivots: TransformNode[] = [];
  private flashAge = 1;
  private offset = new Vector3();
  constructor(scene: Scene, parent: Node, container: AssetContainer | undefined, fx: FxTextures) {
    this.root = new TransformNode('viewmodel', scene); this.root.parent = parent;
    this.holder = new TransformNode('viewmodel-holder', scene); this.holder.parent = this.root;
    if (container) {
      const inst = container.instantiateModelsToScene(n => `vm-${n}`, false, { doNotInstantiate: true });
      const gltfRoot = inst.rootNodes[0] as TransformNode; gltfRoot.parent = this.holder; gltfRoot.setEnabled(true);
      const find = (name: string) => gltfRoot.getDescendants(false).find(n => n.name === `vm-${name}`) as TransformNode | undefined;
      const map: [Weapon, string, string?][] = [['rifle', 'VM_RifleRoot', 'Rifle_Muzzle'], ['pistol', 'VM_PistolRoot', 'Pistol_Muzzle'], ['knife', 'VM_KnifeRoot'], ['frag', 'VM_FragRoot'], ['smoke', 'VM_SmokeRoot']];
      for (const [w, node, muzzle] of map) {
        const root = find(node); if (!root) continue;
        this.poses.set(w, { root, hip: new Vector3(HIP[w][0], HIP[w][1], HIP[w][2]), hipRot: new Vector3(HIP[w][3], HIP[w][4], HIP[w][5]), ads: Vector3.Zero() });
        if (muzzle) { const m = find(muzzle); if (m) this.muzzles.set(w, m); }
      }
      this.eject = find('Rifle_Eject');
      for (const p of ['Proj_Frag', 'Proj_Smoke']) find(p)?.setEnabled(false);
      for (const m of gltfRoot.getChildMeshes(false)) this.prepare(m);
    }
    // muzzle flash: two crossed side flames and a star facing the camera
    const flame = new StandardMaterial('vm-flash', scene);
    flame.diffuseTexture = fx.get('muzzle_02.jpg'); flame.opacityTexture = fx.get('muzzle_02.jpg'); flame.emissiveColor = new Color3(1, 0.72, 0.38);
    flame.disableLighting = true; flame.backFaceCulling = false; flame.alphaMode = 1; flame.fogEnabled = false;
    const star = new StandardMaterial('vm-flash-star', scene);
    star.diffuseTexture = fx.get('scorch_01.jpg'); star.opacityTexture = fx.get('scorch_01.jpg'); star.emissiveColor = new Color3(1, 0.78, 0.45);
    star.disableLighting = true; star.backFaceCulling = false; star.alphaMode = 1; star.fogEnabled = false;
    for (let i = 0; i < 3; i++) {
      const m = MeshBuilder.CreatePlane('vm-muzzle-flash', { width: i < 2 ? 0.1 : 0.14, height: i < 2 ? 0.2 : 0.14 }, scene);
      m.material = i < 2 ? flame : star; m.isPickable = false; m.renderingGroupId = 2; m.setEnabled(false);
      const pivot = new TransformNode('vm-flash-pivot', scene); m.parent = pivot;
      this.flashes.push(m); this.pivots.push(pivot);
    }
    this.select('rifle');
  }
  private prepare(m: AbstractMesh) {
    if (m.material?.name === 'M_Blade') (m.material as unknown as { roughness: number }).roughness = 0.5;
    m.renderingGroupId = 2; m.isPickable = false; m.receiveShadows = false; m.alwaysSelectAsActiveMesh = true; }
  select(kind: Weapon) {
    if (kind !== this.current) this.switchTime = 0.32;
    this.current = kind;
    this.poses.forEach((p, k) => p.root.setEnabled(k === kind));
  }
  shot() {
    this.recoil = 1; this.flashAge = 0;
    const muzzle = this.muzzles.get(this.current);
    if (!muzzle) return;
    const roll = Math.random() * Math.PI;
    // The muzzle node's local +Z points down the barrel. Each pivot rolls about that axis;
    // side flames lie along the pivot's Z after a quarter turn about X.
    this.pivots.forEach((pivot, i) => {
      pivot.parent = muzzle; pivot.position.setAll(0);
      pivot.rotation.set(0, 0, roll + i * Math.PI / 2);
      const f = this.flashes[i]; f.setEnabled(true);
      if (i < 2) { f.position.set(0, 0, 0.09); f.rotation.set(Math.PI / 2, 0, 0); } else { f.position.set(0, 0, 0.015); f.rotation.set(0, 0, 0); }
      const s = 0.8 + Math.random() * 0.5; pivot.scaling.setAll(this.current === 'pistol' ? s * 0.7 : s);
    });
  }
  swing() { this.swingTime = 0.4; }
  throw() { this.throwTime = 0.55; }
  look(dx: number, dy: number) { this.swayX = Math.max(-1, Math.min(1, this.swayX + dx * 0.0025)); this.swayY = Math.max(-1, Math.min(1, this.swayY + dy * 0.0025)); }
  muzzleWorld() {
    const m = this.muzzles.get(this.current);
    return m ? m.getAbsolutePosition().clone() : null;
  }
  ejectWorld() { return this.eject && this.current === 'rifle' ? this.eject.getAbsolutePosition().clone() : null; }
  update(time: number, moving: boolean, sprinting: boolean, ads: number, reload: number, kind: Weapon, dt: number) {
    if (kind !== this.current) this.select(kind);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.flashAge += dt;
    const flashOn = this.flashAge < 0.045;
    for (const f of this.flashes) f.setEnabled(flashOn);
    this.switchTime = Math.max(0, this.switchTime - dt); this.swingTime = Math.max(0, this.swingTime - dt); this.throwTime = Math.max(0, this.throwTime - dt);
    this.swayX *= Math.exp(-dt * 9); this.swayY *= Math.exp(-dt * 9);
    const pose = this.poses.get(kind);
    const hip = pose?.hip ?? Vector3.Zero(), hipRot = pose?.hipRot ?? Vector3.Zero();
    const settle = 1 - ads;
    const bobAmp = moving ? (sprinting ? 0.022 : 0.011) * settle + 0.002 : 0;
    const bobX = Math.sin(time * (sprinting ? 7.5 : 6)) * bobAmp, bobY = -Math.abs(Math.cos(time * (sprinting ? 7.5 : 6))) * bobAmp * 0.9;
    const breathe = Math.sin(time * 1.6) * 0.0018 * (1 - ads * 0.7);
    const sw = Math.sin(this.switchTime / 0.32 * Math.PI);
    const reloadDip = Math.sin(Math.min(1, reload) * Math.PI);
    const swing = this.swingTime > 0 ? Math.sin((1 - this.swingTime / 0.4) * Math.PI) : 0;
    const thr = this.throwTime > 0 ? 1 - this.throwTime / 0.55 : 0;
    const throwLift = thr > 0 ? (thr < 0.45 ? thr / 0.45 : 1 - (thr - 0.45) / 0.55) : 0;
    this.offset.set(
      hip.x * settle + bobX - this.swayX * 0.012 + (sprinting ? 0.03 : 0),
      hip.y * settle + bobY + breathe + this.swayY * 0.01 - 0.16 * sw - 0.09 * reloadDip - (sprinting ? 0.035 : 0) + throwLift * 0.08,
      hip.z * settle - this.recoil * (kind === 'pistol' ? 0.03 : 0.045) + swing * 0.22 - throwLift * 0.06,
    );
    this.holder.position = Vector3.Lerp(this.holder.position, this.offset, Math.min(1, dt * 22));
    this.holder.rotation.set(
      hipRot.x * settle - this.recoil * (kind === 'pistol' ? 0.09 : 0.05) + reloadDip * 0.35 + this.swayY * 0.03 + sw * 0.5 + (sprinting ? 0.25 : 0) - throwLift * 0.6 + swing * 0.25,
      hipRot.y * settle + this.swayX * 0.03 + Math.sin(time * 1.1) * 0.003 * settle + (sprinting ? -0.35 : 0),
      hipRot.z * settle + (moving ? Math.sin(time * 3) * 0.01 * settle : 0) + reloadDip * 0.28 - this.swayX * 0.02 + (sprinting ? 0.15 : 0),
    );
  }
}
