import {
  AbstractMesh, AssetContainer, Color3, DynamicTexture, Mesh, MeshBuilder, PBRMaterial, Quaternion, Scene, StandardMaterial, TransformNode, Vector3, type FreeCamera,
} from '../babylon';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeBox, PhysicsShapeContainer } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Navigation, Collider, Point } from './navigation';
import { Materials } from './materials';
import { Environment } from './environment';
import { Kit } from './kit';
import { buildLayout } from './layouts';
import { MAPS } from '../config/maps';
import type { Settings } from '../config/game';
import type { ModelName } from '../assets';

export type Prop = {
  root: TransformNode; parts: AbstractMesh[]; position: Vector3; collider: Collider; health: number; kind: 'crate' | 'barrel';
  warning: number; credited: boolean; destroyed: boolean; burning?: { stop: () => void };
};
export type Supply = { id: string; kind: 'health' | 'ammo'; mesh: TransformNode; position: Vector3; used: boolean };

/** Models every map needs: the props layouts may place plus gameplay objects. */
export const MAP_MODELS: ModelName[] = [
  'barrel', 'jersey', 'militaryCrate', 'ammoBox', 'medicalBox', 'tyre', 'jerrycan', 'lpg', 'propane', 'plasticCrate', 'plasticCrate3',
  'cardboard', 'trashbag', 'dumpster', 'utilityBox', 'streetLamp', 'shutterDoor', 'chair', 'table', 'generator', 'bush',
  'sedanBurnt', 'hatchRust', 'pickupBurnt', 'carBroken',
];

export class BattleMap {
  nav!: Navigation;
  materials: Materials;
  env: Environment;
  kit: Kit;
  props: Prop[] = [];
  supplies: Supply[] = [];
  enemySpawns: Point[] = [];
  playerSpawns: Point[] = [];
  get shadows() { return this.env.shadows; }
  get atmosphere() { return MAPS[this.index]; }
  constructor(public scene: Scene, public index: number, camera: FreeCamera, quality: Settings['quality'], public models: Partial<Record<ModelName, AssetContainer>>) {
    this.materials = new Materials(scene, quality);
    this.env = new Environment(scene, camera, MAPS[index], quality);
    this.kit = new Kit(scene, this.materials, 101 + index, this.env, models);
    const layout = buildLayout(this.kit, index);
    this.nav = this.kit.nav;
    this.playerSpawns = layout.playerSpawns;
    this.enemySpawns = this.kit.enemySpawns;
    layout.health.forEach((p, i) => this.addSupply(`health-${i}`, 'health', p));
    layout.ammo.forEach((p, i) => this.addSupply(`ammo-${i}`, 'ammo', p));
    for (const p of layout.barrels) this.prop('barrel', p);
    for (const p of layout.crates) this.prop('crate', p);
    for (const f of this.kit.firePoints) this.env.fire(f.at, f.scale, f.light);
    this.kit.finishDecals();
  }
  /** Explosive fuel drum or destructible crate stack. */
  prop(kind: 'crate' | 'barrel', p: Point) {
    const y = p.y ?? 0, k = this.kit;
    let root: TransformNode | null, collider: Collider;
    if (kind === 'barrel') {
      root = k.prop('barrel', p.x, p.z, k.range(0, 6), { y, dynamic: true, collide: false });
      collider = k.collider(p.x, p.z, 0.62, 0.62, y, y + 0.88);
    } else {
      const rot = k.range(-0.3, 0.3);
      root = new TransformNode('crate-stack', this.scene); root.position.set(p.x, y, p.z); root.rotation.y = rot;
      for (const [dx, dz, dy] of [[0, -0.27, 0], [0, 0.27, 0], [0.05, 0, 0.47]] as const) {
        const c = k.prop('militaryCrate', 0, 0, 0, { collide: false, dynamic: true });
        if (c) { c.parent = root; c.position.set(dx, dy, dz); c.rotation.y = dy ? 0.2 : 0; }
      }
      collider = k.collider(p.x, p.z, 1.3, 1.1, y, y + 0.94);
    }
    root ??= new TransformNode(`${kind}-placeholder`, this.scene);
    const prop: Prop = { root, parts: root.getChildMeshes(), position: new Vector3(p.x, y, p.z), collider, kind, health: kind === 'barrel' ? 2 : 4, warning: -1, credited: false, destroyed: false };
    for (const m of prop.parts) { m.metadata = { solid: true, prop, surface: kind === 'barrel' ? 'metal' : 'wood' }; m.isPickable = true; }
    this.props.push(prop);
    return prop;
  }
  addSupply(id: string, kind: 'health' | 'ammo', p: Point) {
    const y = p.y ?? 0, root = new TransformNode(id, this.scene), k = this.kit;
    root.position.set(p.x, y, p.z);
    if (kind === 'health') {
      const box = k.prop('medicalBox', 0, 0, 0, { collide: false, dynamic: true });
      if (box) { box.parent = root; box.position.set(0, 0.02, 0); box.rotation.y = 0.4; }
      // pale cross on the lid keeps packs legible from a distance
      const lid = MeshBuilder.CreatePlane('health-cross', { size: 0.26 }, this.scene);
      lid.parent = root; lid.position.y = 0.13; lid.rotation.x = Math.PI / 2; lid.rotation.y = 0.4;
      lid.material = this.crossMaterial(); lid.isPickable = false;
    } else {
      const crate = k.prop('militaryCrate', 0, 0, 0, { collide: false, dynamic: true });
      if (crate) { crate.parent = root; crate.position.set(0, 0, 0); }
      for (const dx of [-0.35, 0.05]) {
        const can = k.prop('ammoBox', 0, 0, 0, { collide: false, dynamic: true });
        if (can) { can.parent = root; can.position.set(dx, 0.47, 0.02); can.rotation.y = Math.PI / 2 + dx; }
      }
      const tex = new DynamicTexture(`${id}-stencil`, { width: 512, height: 128 }, this.scene, true);
      const ctx = tex.getContext() as CanvasRenderingContext2D; ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = 'rgba(232,206,96,.95)'; ctx.font = 'bold 82px Arial'; ctx.fillText('AMMO', (512 - ctx.measureText('AMMO').width) / 2, 96); tex.hasAlpha = true; tex.update();
      const m = new PBRMaterial(`${id}-label`, this.scene); m.albedoTexture = tex; m.useAlphaFromAlbedoTexture = true; m.roughness = 0.9; m.metallic = 0;
      m.emissiveColor = new Color3(0.25, 0.21, 0.08); m.emissiveTexture = tex;
      for (const side of [-1, 1]) {
        const label = MeshBuilder.CreatePlane('ammo-stencil', { width: 0.9, height: 0.22 }, this.scene);
        label.parent = root; label.position.set(0, 0.24, side * 0.27); label.rotation.y = side === -1 ? 0 : Math.PI; label.material = m; label.isPickable = false;
      }
    }
    for (const m of root.getChildMeshes()) m.isPickable = false;
    this.supplies.push({ id, kind, mesh: root, position: new Vector3(p.x, y + 0.5, p.z), used: false });
  }
  private crossTex?: StandardMaterial;
  private crossMaterial() {
    if (this.crossTex) return this.crossTex;
    const tex = new DynamicTexture('cross', { width: 64, height: 64 }, this.scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D; c.clearRect(0, 0, 64, 64); c.fillStyle = '#f2efe6'; c.fillRect(24, 8, 16, 48); c.fillRect(8, 24, 48, 16); tex.hasAlpha = true; tex.update();
    const m = new StandardMaterial('cross-mat', this.scene); m.diffuseTexture = tex; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new Color3(0.55, 0.55, 0.5); m.specularColor = Color3.Black();
    this.crossTex = m; return m;
  }
  /** Merge static geometry by material, so a district renders in a few dozen draw calls. */
  batchStaticGeometry() {
    const groups = new Map<string, Mesh[]>();
    for (const m of this.kit.staticMeshes) {
      if (m.isDisposed() || !m.material) continue;
      const key = `${m.material.uniqueId}-${!!m.metadata?.solid}`;
      let g = groups.get(key); if (!g) groups.set(key, g = []); g.push(m);
    }
    const casters: Mesh[] = [];
    for (const group of groups.values()) {
      const meta = group[0].metadata ?? {}, cast = group.some(m => m.metadata?.cast);
      const merged = group.length > 1 ? Mesh.MergeMeshes(group, true, true, undefined, false, false) : group[0];
      if (!merged) continue;
      merged.name = 'environment'; merged.metadata = { solid: !!meta.solid, surface: meta.surface ?? 'concrete', cast };
      merged.receiveShadows = true; merged.isPickable = !!meta.solid; merged.freezeWorldMatrix();
      merged.alwaysSelectAsActiveMesh = false;
      if (cast) casters.push(merged);
    }
    const sm = this.shadows?.getShadowMap();
    if (sm) sm.renderList = [...(sm.renderList ?? []).filter(m => !m.isDisposed()), ...casters];
    this.kit.staticMeshes = [];
  }
  /** One static Havok body (compound of boxes) so debris collides with the city. */
  createPhysics() {
    const node = new TransformNode('static-physics', this.scene);
    const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.scene);
    const shape = new PhysicsShapeContainer(this.scene);
    const q = Quaternion.Identity();
    shape.addChild(new PhysicsShapeBox(new Vector3(0, -0.5, 0), q, new Vector3(90, 1, 90), this.scene));
    for (const c of this.nav.colliders.concat(this.nav.platforms)) {
      if (c.top - c.bottom < 0.05) continue;
      shape.addChild(new PhysicsShapeBox(new Vector3(c.x, (c.top + c.bottom) / 2, c.z), q, new Vector3(c.w, c.top - c.bottom, c.d), this.scene));
    }
    body.shape = shape;
  }
  dispose() { this.scene.dispose(); }
}
