import { AssetContainer, LoadAssetContainerAsync, type Scene } from './babylon';

/** Every runtime model, bundled locally under public/assets/models. */
export const MODELS = {
  fighter: 'models/fighter.glb',
  viewmodel: 'models/viewmodel.glb',
  barrel: 'models/props/Barrel_01.glb',
  jersey: 'models/props/concrete_road_barrier.glb',
  militaryCrate: 'models/props/wooden_military_crate.glb',
  ammoBox: 'models/props/ammo_box.glb',
  medicalBox: 'models/props/medical_box.glb',
  tyre: 'models/props/old_tyre.glb',
  jerrycan: 'models/props/metal_jerrycan.glb',
  lpg: 'models/props/small_lpg_tank.glb',
  propane: 'models/props/propane_tank.glb',
  plasticCrate: 'models/props/plastic_crate_01.glb',
  plasticCrate3: 'models/props/plastic_crate_03.glb',
  cardboard: 'models/props/cardboard_box_01.glb',
  trashbag: 'models/props/trashbag.glb',
  dumpster: 'models/props/metal_trash_can.glb',
  utilityBox: 'models/props/utility_box_01.glb',
  streetLamp: 'models/props/street_lamp_01.glb',
  shutterDoor: 'models/props/rollershutter_door.glb',
  chair: 'models/props/plastic_monobloc_chair_01.glb',
  table: 'models/props/wooden_table_02.glb',
  generator: 'models/props/portable_generator.glb',
  bush: 'models/props/wild_rooibos_bush.glb',
  sedanBurnt: 'models/props/wreck_sedan_burnt.glb',
  hatchRust: 'models/props/wreck_hatch_rust.glb',
  pickupBurnt: 'models/props/wreck_pickup_burnt.glb',
  carBroken: 'models/props/wreck_broken.glb',
} as const;
export type ModelName = keyof typeof MODELS;

/**
 * Downloads each GLB once per page session and loads it into every new scene as an
 * AssetContainer. Scenes are recreated between waves, so the bytes stay cached here.
 */
export class AssetLibrary {
  private bytes = new Map<string, Promise<Uint8Array>>();
  loaded = 0;
  total = 0;
  onProgress?: (fraction: number) => void;
  private fetchBytes(path: string) {
    let p = this.bytes.get(path);
    if (!p) {
      this.total++;
      p = fetch(`${import.meta.env.BASE_URL}assets/${path}`).then(async r => {
        if (!r.ok) throw new Error(`Asset missing: ${path}`);
        const data = new Uint8Array(await r.arrayBuffer());
        this.loaded++; this.onProgress?.(this.loaded / Math.max(1, this.total));
        return data;
      });
      this.bytes.set(path, p);
    }
    return p;
  }
  /** Start downloading everything so later waves load from memory. */
  prefetch(names: ModelName[] = Object.keys(MODELS) as ModelName[]) { return Promise.all(names.map(n => this.fetchBytes(MODELS[n]))); }
  async containers(scene: Scene, names: ModelName[]) {
    const out = {} as Record<ModelName, AssetContainer>;
    await Promise.all(names.map(async n => {
      const data = await this.fetchBytes(MODELS[n]);
      out[n] = await LoadAssetContainerAsync(data, scene, { pluginExtension: '.glb', name: n });
    }));
    return out;
  }
}
