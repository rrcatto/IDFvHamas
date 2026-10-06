import { Color3, PBRMaterial, Scene, StandardMaterial, Texture } from '../babylon';
import type { Settings } from '../config/game';

export type Surface = 'concrete' | 'metal' | 'wood' | 'dirt' | 'fabric' | 'glass';
/** A physically based surface built from a Poly Haven texture set (albedo, normal, AO/roughness/metal). */
export type MaterialSpec = { set: string; tile: number; tint?: string; surface: Surface; roughness?: number; bump?: number; emissive?: string };

/** Shared surface library. `tile` is the world size in metres covered by one texture repeat. */
export const SURFACES: Record<string, MaterialSpec> = {
  // walls
  sandstone: { set: 'sandstone_blocks_04', tile: 2.4, surface: 'concrete' },
  clayPlaster: { set: 'clay_plaster', tile: 3, surface: 'concrete' },
  beigePlaster: { set: 'beige_wall_002', tile: 3, surface: 'concrete' },
  damagedPlaster: { set: 'damaged_plaster', tile: 2.6, surface: 'concrete' },
  plasterBrick: { set: 'rough_plaster_brick', tile: 2.6, surface: 'concrete' },
  whitePlaster: { set: 'concrete_wall_003', tile: 3, surface: 'concrete' },
  greyPlaster: { set: 'grey_plaster_02', tile: 3, surface: 'concrete' },
  crackedWall: { set: 'cracked_concrete_wall', tile: 3, surface: 'concrete' },
  paintedConcrete: { set: 'painted_concrete', tile: 3, surface: 'concrete' },
  bluePlaster: { set: 'blue_plaster_weathered', tile: 3, surface: 'concrete' },
  hackedConcrete: { set: 'hacked_concrete', tile: 3, surface: 'concrete' },
  cinderblock: { set: 'concrete_block_wall', tile: 2.4, surface: 'concrete' },
  panelConcrete: { set: 'concrete_wall_004', tile: 4, surface: 'concrete' },
  slabConcrete: { set: 'concrete_slab_wall', tile: 4, surface: 'concrete' },
  dirtyConcrete: { set: 'dirty_concrete', tile: 3, surface: 'concrete' },
  layeredConcrete: { set: 'concrete_layers', tile: 3, surface: 'concrete' },
  // ground
  pavers: { set: 'concrete_pavers_03', tile: 3, surface: 'concrete' },
  interlock: { set: 'interlocking_concrete_pavers', tile: 2.5, surface: 'concrete' },
  sandCracks: { set: 'sandstone_cracks', tile: 5, surface: 'dirt' },
  dryRocks: { set: 'dry_ground_rocks', tile: 4, surface: 'dirt' },
  asphalt: { set: 'asphalt_02', tile: 6, surface: 'concrete' },
  asphaltWorn: { set: 'asphalt_04', tile: 6, surface: 'concrete' },
  roadDamaged: { set: 'road_damaged', tile: 6, surface: 'concrete' },
  gravelSand: { set: 'gravelly_sand', tile: 4, surface: 'dirt' },
  burnt: { set: 'burned_ground_01', tile: 5, surface: 'dirt' },
  rockyGround: { set: 'aerial_ground_rock', tile: 6, surface: 'dirt' },
  dryGround: { set: 'dry_ground_01', tile: 5, surface: 'dirt' },
  rubble: { set: 'concrete_debris', tile: 2, surface: 'concrete', tint: '#a49e92' },
  // interiors
  wornTiles: { set: 'worn_tile_floor', tile: 2.5, surface: 'concrete' },
  interiorTiles: { set: 'interior_tiles', tile: 2.5, surface: 'concrete' },
  terrazzo: { set: 'terrazzo_tiles', tile: 2.5, surface: 'concrete' },
  dirtyTiles: { set: 'dirty_tiles', tile: 2, surface: 'concrete' },
  // wood, metal, fabric
  wood: { set: 'rough_wood', tile: 1.6, surface: 'wood' },
  planks: { set: 'old_planks_02', tile: 1.6, surface: 'wood' },
  rustShutter: { set: 'rusty_metal_shutter', tile: 2.5, surface: 'metal' },
  paintedShutter: { set: 'painted_metal_shutter', tile: 2.5, surface: 'metal' },
  rustyMetal: { set: 'rusty_metal_02', tile: 2, surface: 'metal' },
  greenMetal: { set: 'green_metal_rust', tile: 2, surface: 'metal' },
  corrugated: { set: 'rusty_corrugated_iron', tile: 2.5, surface: 'metal' },
  redMetal: { set: 'rusty_painted_metal', tile: 2, surface: 'metal' },
  hessian: { set: 'hessian_230', tile: 0.8, surface: 'fabric' },
};

export class Materials {
  private cache = new Map<string, PBRMaterial>();
  private textures = new Map<string, Texture>();
  readonly specs = new Map<string, MaterialSpec>();
  constructor(private scene: Scene, private quality: Settings['quality']) {}
  private texture(url: string, linear = false) {
    let t = this.textures.get(url);
    if (!t) {
      t = new Texture(url, this.scene, { noMipmap: false, gammaSpace: !linear });
      t.anisotropicFilteringLevel = this.quality === 'High' ? 8 : this.quality === 'Medium' ? 4 : 1;
      this.textures.set(url, t);
    }
    return t;
  }
  /** PBR material for a surface id, optionally recoloured (`id@tint`). */
  get(id: string, tint?: string, interior = false) {
    const key = (tint ? `${id}@${tint}` : id) + (interior ? '!in' : '');
    const cached = this.cache.get(key); if (cached) return cached;
    const base = SURFACES[id];
    if (!base) throw new Error(`Unknown surface ${id}`);
    const spec: MaterialSpec = { ...base, tint: tint ?? base.tint };
    const m = new PBRMaterial(key, this.scene);
    const root = `${import.meta.env.BASE_URL}assets/textures/${spec.set}/`;
    m.albedoTexture = this.texture(root + 'albedo.jpg');
    if (this.quality !== 'Low') {
      m.bumpTexture = this.texture(root + 'normal.jpg', true);
      m.bumpTexture.level = spec.bump ?? 1;
      m.invertNormalMapY = true;
      m.metallicTexture = this.texture(root + 'arm.jpg', true);
      m.useAmbientOcclusionFromMetallicTextureRed = true;
      m.useRoughnessFromMetallicTextureGreen = true;
      m.useMetallnessFromMetallicTextureBlue = true;
      m.metallic = 1; m.roughness = spec.roughness ?? 1;
    } else { m.metallic = spec.surface === 'metal' ? 0.6 : 0; m.roughness = 0.9; }
    if (spec.tint) m.albedoColor = Color3.FromHexString(spec.tint);
    if (spec.emissive) m.emissiveColor = Color3.FromHexString(spec.emissive);
    // Image-based light has no occlusion, so interiors would glow like outdoors without this.
    if (interior) { m.environmentIntensity = 0.38; m.directIntensity = 1; }
    m.maxSimultaneousLights = 4;
    this.cache.set(key, m); this.specs.set(key, spec);
    return m;
  }
  spec(key: string) { return this.specs.get(key) ?? SURFACES[key]; }
  /** Flat PBR colour, used for small details that do not need texture maps. */
  flat(name: string, hex: string, roughness = 0.85, metallic = 0) {
    const key = `flat-${name}`; const cached = this.cache.get(key); if (cached) return cached;
    const m = new PBRMaterial(key, this.scene); m.albedoColor = Color3.FromHexString(hex).toLinearSpace(); m.roughness = roughness; m.metallic = metallic;
    this.cache.set(key, m); this.specs.set(key, { set: '', tile: 1, surface: metallic > 0.4 ? 'metal' : 'concrete' });
    return m;
  }
  glow(name: string, hex: string, alpha = 1) {
    const m = new StandardMaterial(name, this.scene); m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = m.diffuseColor; m.disableLighting = true; m.alpha = alpha; return m;
  }
}
