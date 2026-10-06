import {
  Color3, Color4, ColorCurves, CubeTexture, DefaultRenderingPipeline, DirectionalLight, HemisphericLight, ImageProcessingConfiguration,
  Mesh, MeshBuilder, ParticleSystem, PointLight, Scene, ShadowGenerator, StandardMaterial, Texture, Vector3, type FreeCamera,
} from '../babylon';
import { EquiRectangularCubeTexture } from '@babylonjs/core/Materials/Textures/equiRectangularCubeTexture';
import type { Atmosphere } from '../config/maps';
import type { Settings } from '../config/game';

const BASE = () => `${import.meta.env.BASE_URL}assets/`;

/** Shared sprite textures for particles and decals. */
export class FxTextures {
  private cache = new Map<string, Texture>();
  constructor(private scene: Scene) {}
  get(name: string) {
    let t = this.cache.get(name);
    if (!t) { t = new Texture(`${BASE()}fx/${name}`, this.scene, true, true); t.hasAlpha = name.endsWith('.png'); this.cache.set(name, t); }
    return t;
  }
}

export function sunDirection(a: Atmosphere) {
  const el = a.sun.elevation * Math.PI / 180, az = a.sun.azimuth * Math.PI / 180;
  // Direction the light travels: from the sun towards the ground.
  return new Vector3(-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/**
 * Sky, image-based lighting, sun/shadows, fog, colour grading and ambient particles for one map.
 */
export class Environment {
  sun: DirectionalLight;
  hemi: HemisphericLight;
  shadows?: ShadowGenerator;
  pipeline?: DefaultRenderingPipeline;
  sky: Mesh;
  private motes?: ParticleSystem;
  private fires: { light?: PointLight; base: number; phase: number }[] = [];
  private time = 0;
  readonly fx: FxTextures;
  constructor(public scene: Scene, public camera: FreeCamera, public preset: Atmosphere, public quality: Settings['quality']) {
    this.fx = new FxTextures(scene);
    const env = CubeTexture.CreateFromPrefilteredData(`${BASE()}env/${preset.env}.env`, scene);
    env.rotationY = preset.skyRotation;
    scene.environmentTexture = env;
    scene.environmentIntensity = preset.envIntensity;
    scene.clearColor = Color4.FromHexString(preset.fog.color + 'ff');
    scene.ambientColor = new Color3(0, 0, 0);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = preset.fog.density; scene.fogColor = Color3.FromHexString(preset.fog.color);

    // Sky panorama on an inward sphere, sampled as a cube map so it lines up with the IBL.
    this.sky = MeshBuilder.CreateSphere('sky-dome', { diameter: 760, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
    const skyTex = new EquiRectangularCubeTexture(`${BASE()}env/${preset.sky}.jpg`, scene, quality === 'Low' ? 256 : 512, false, true);
    skyTex.coordinatesMode = Texture.SKYBOX_MODE;
    const skyMat = new StandardMaterial('sky-material', scene);
    skyMat.reflectionTexture = skyTex; skyMat.backFaceCulling = false; skyMat.disableLighting = true;
    skyMat.diffuseColor = Color3.Black(); skyMat.specularColor = Color3.Black(); skyMat.fogEnabled = false;
    this.sky.material = skyMat; this.sky.infiniteDistance = true; this.sky.isPickable = false; this.sky.applyFog = false;
    this.sky.renderingGroupId = 0;

    this.hemi = new HemisphericLight('sky-fill', new Vector3(0.1, 1, -0.2), scene);
    this.hemi.intensity = preset.hemi.intensity;
    this.hemi.diffuse = Color3.FromHexString(preset.hemi.sky); this.hemi.groundColor = Color3.FromHexString(preset.hemi.ground);
    this.hemi.specular = Color3.Black();

    const dir = sunDirection(preset);
    this.sun = new DirectionalLight('sun', dir, scene);
    this.sun.position = dir.scale(-90);
    this.sun.intensity = preset.sun.intensity; this.sun.diffuse = Color3.FromHexString(preset.sun.color);
    this.sun.shadowMinZ = 1; this.sun.shadowMaxZ = 220;
    this.sun.autoUpdateExtends = false;
    this.sun.orthoLeft = -58; this.sun.orthoRight = 58; this.sun.orthoTop = 58; this.sun.orthoBottom = -58;
    if (quality !== 'Low') this.createShadows(quality);

    this.pipeline = new DefaultRenderingPipeline('grade', true, scene, [camera]);
    const p = this.pipeline;
    p.samples = 1;
    p.fxaaEnabled = true;
    p.imageProcessingEnabled = true;
    const ip = p.imageProcessing;
    ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = preset.exposure; ip.contrast = preset.contrast;
    ip.vignetteEnabled = true; ip.vignetteWeight = 2.2; ip.vignetteStretch = 0.6; ip.vignetteColor = new Color4(0.05, 0.035, 0.02, 0);
    ip.colorCurvesEnabled = true;
    const curves = new ColorCurves();
    curves.globalSaturation = preset.saturation;
    curves.highlightsHue = 40; curves.highlightsDensity = preset.warmth * 0.6; curves.highlightsSaturation = preset.warmth;
    curves.shadowsHue = 210; curves.shadowsDensity = 18; curves.shadowsSaturation = 12;
    ip.colorCurves = curves;
    p.bloomEnabled = quality !== 'Low';
    p.bloomThreshold = 0.82; p.bloomWeight = 0.22; p.bloomKernel = 48; p.bloomScale = 0.5;
    p.grainEnabled = quality === 'High'; p.grain.intensity = 5; p.grain.animated = true;
    p.chromaticAberrationEnabled = false;
    p.sharpenEnabled = quality !== 'Low'; p.sharpen.edgeAmount = 0.18;

    this.ambient();
    for (const [x, z, s] of preset.smokeColumns) this.smokeColumn(new Vector3(x, 0, z), s);
  }
  private createShadows(quality: Settings['quality']) {
    const s = new ShadowGenerator(quality === 'High' ? 4096 : 2048, this.sun);
    s.usePercentageCloserFiltering = true;
    s.filteringQuality = quality === 'High' ? ShadowGenerator.QUALITY_MEDIUM : ShadowGenerator.QUALITY_LOW;
    s.bias = 0.0012; s.normalBias = 0.018; s.setDarkness(this.preset.shadowDarkness);
    this.shadows = s;
    return s;
  }
  /** Dynamic casters (enemies, props), remembered so a later switch up from Low can add them. */
  private casters: { mesh: { isDisposed?: () => boolean }; descendants: boolean }[] = [];
  caster(mesh: { getChildMeshes?: () => unknown[]; isDisposed?: () => boolean } & object, descendants = true) {
    this.casters.push({ mesh, descendants });
    this.shadows?.addShadowCaster(mesh as never, descendants);
  }
  private ambient() {
    const budget = this.quality === 'High' ? 1 : this.quality === 'Medium' ? 0.6 : 0.25;
    const ps = new ParticleSystem('ambient-motes', Math.ceil(420 * budget), this.scene);
    const ash = this.preset.ambient === 'ash';
    ps.particleTexture = this.fx.get(ash ? 'dirt_01.png' : 'circle_05.jpg');
    ps.emitter = this.camera.position.clone();
    ps.minEmitBox = new Vector3(-14, -2, -14); ps.maxEmitBox = new Vector3(14, 7, 14);
    ps.color1 = ash ? new Color4(0.24, 0.23, 0.22, 0.75) : new Color4(0.95, 0.85, 0.65, 0.22);
    ps.color2 = ash ? new Color4(0.38, 0.36, 0.34, 0.55) : new Color4(0.85, 0.75, 0.6, 0.12);
    ps.colorDead = new Color4(0.5, 0.45, 0.4, 0);
    ps.minSize = ash ? 0.025 : 0.02; ps.maxSize = ash ? 0.07 : 0.05;
    ps.minLifeTime = 4; ps.maxLifeTime = 9;
    ps.emitRate = 55 * budget;
    ps.blendMode = ash ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0.25, ash ? -0.35 : 0.02, 0.1);
    ps.direction1 = new Vector3(-0.15, -0.05, -0.15); ps.direction2 = new Vector3(0.2, 0.08, 0.2);
    ps.minEmitPower = 0.1; ps.maxEmitPower = 0.35;
    ps.minAngularSpeed = -1; ps.maxAngularSpeed = 1;
    ps.start();
    this.motes = ps;
  }
  /** A tall drifting smoke plume far beyond the playable area. */
  smokeColumn(at: Vector3, scale = 1) {
    const budget = this.quality === 'Low' ? 0.5 : 1;
    const ps = new ParticleSystem('smoke-column', Math.ceil(70 * budget), this.scene);
    ps.particleTexture = this.fx.get('smoke_04.png');
    ps.emitter = at; ps.minEmitBox = new Vector3(-2, 0, -2); ps.maxEmitBox = new Vector3(2, 2, 2);
    ps.color1 = new Color4(0.12, 0.11, 0.1, 0.55); ps.color2 = new Color4(0.2, 0.18, 0.16, 0.45); ps.colorDead = new Color4(0.35, 0.33, 0.3, 0);
    ps.minSize = 5 * scale; ps.maxSize = 9 * scale; ps.minLifeTime = 12; ps.maxLifeTime = 20;
    ps.addSizeGradient(0, 4 * scale); ps.addSizeGradient(1, 22 * scale);
    ps.emitRate = 4.5 * budget;
    ps.direction1 = new Vector3(-0.2, 1, -0.2); ps.direction2 = new Vector3(0.2, 1, 0.2);
    ps.minEmitPower = 2.5; ps.maxEmitPower = 4; ps.gravity = new Vector3(1.4, 0.15, 0.5);
    ps.minAngularSpeed = -0.2; ps.maxAngularSpeed = 0.2;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.preWarmCycles = 120; ps.preWarmStepOffset = 10;
    ps.start();
    return ps;
  }
  /** Persistent flames and smoke over burning wreckage. */
  fire(at: Vector3, scale = 1, light = false) {
    const flames = new ParticleSystem('fire', 60, this.scene);
    flames.particleTexture = this.fx.get('fire_01.jpg');
    flames.emitter = at; flames.minEmitBox = new Vector3(-0.5 * scale, 0, -0.5 * scale); flames.maxEmitBox = new Vector3(0.5 * scale, 0.2, 0.5 * scale);
    flames.color1 = new Color4(1, 0.55, 0.18, 1); flames.color2 = new Color4(1, 0.38, 0.08, 1); flames.colorDead = new Color4(0.2, 0.05, 0, 0);
    flames.minSize = 0.5 * scale; flames.maxSize = 1.1 * scale; flames.minLifeTime = 0.35; flames.maxLifeTime = 0.8;
    flames.emitRate = 45; flames.blendMode = ParticleSystem.BLENDMODE_ADD;
    flames.direction1 = new Vector3(-0.2, 1, -0.2); flames.direction2 = new Vector3(0.2, 1.4, 0.2);
    flames.minEmitPower = 0.8; flames.maxEmitPower = 1.6; flames.gravity = new Vector3(0, 1.2, 0);
    flames.minAngularSpeed = -2; flames.maxAngularSpeed = 2;
    flames.start();
    const smoke = new ParticleSystem('fire-smoke', 50, this.scene);
    smoke.particleTexture = this.fx.get('smoke_07.png');
    smoke.emitter = at.add(new Vector3(0, 1.2 * scale, 0)); smoke.minEmitBox = new Vector3(-0.4, 0, -0.4); smoke.maxEmitBox = new Vector3(0.4, 0.3, 0.4);
    smoke.color1 = new Color4(0.1, 0.09, 0.08, 0.5); smoke.color2 = new Color4(0.16, 0.15, 0.14, 0.4); smoke.colorDead = new Color4(0.3, 0.3, 0.3, 0);
    smoke.minSize = 1.2 * scale; smoke.maxSize = 2 * scale; smoke.addSizeGradient(0, 1 * scale); smoke.addSizeGradient(1, 6 * scale);
    smoke.minLifeTime = 4; smoke.maxLifeTime = 7; smoke.emitRate = 7;
    smoke.direction1 = new Vector3(-0.2, 1, -0.2); smoke.direction2 = new Vector3(0.2, 1, 0.2); smoke.minEmitPower = 1; smoke.maxEmitPower = 2;
    smoke.gravity = new Vector3(0.6, 0.3, 0.2); smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    smoke.preWarmCycles = 60; smoke.preWarmStepOffset = 10;
    smoke.start();
    let pl: PointLight | undefined;
    if (light && this.quality === 'High') {
      pl = new PointLight('fire-light', at.add(new Vector3(0, 1, 0)), this.scene);
      pl.diffuse = new Color3(1, 0.55, 0.2); pl.specular = new Color3(0.3, 0.15, 0.05); pl.intensity = 6 * scale; pl.range = 9 * scale;
    }
    this.fires.push({ light: pl, base: pl?.intensity ?? 0, phase: Math.random() * 10 });
    return { flames, smoke, light: pl };
  }
  update(dt: number) {
    this.time += dt;
    if (this.motes) (this.motes.emitter as Vector3).copyFrom(this.camera.position);
    for (const f of this.fires) if (f.light) f.light.intensity = f.base * (0.8 + 0.2 * Math.sin(this.time * 13 + f.phase) * Math.sin(this.time * 7.3 + f.phase * 2));
  }
  setQuality(q: Settings['quality']) {
    this.quality = q;
    if (this.pipeline) {
      this.pipeline.bloomEnabled = q !== 'Low';
      this.pipeline.grainEnabled = q === 'High';
      this.pipeline.sharpenEnabled = q !== 'Low';
    }
    if (q !== 'Low' && !this.shadows) {
      // switching up from Low: build the shadow map from everything marked as a caster
      const s = this.createShadows(q);
      for (const m of this.scene.meshes) if (m.metadata?.cast && !m.isDisposed()) s.addShadowCaster(m, false);
      this.casters = this.casters.filter(c => !c.mesh.isDisposed?.());
      for (const c of this.casters) s.addShadowCaster(c.mesh as never, c.descendants);
      for (const m of this.scene.meshes) m.receiveShadows = m.receiveShadows || !!m.metadata?.static;
    }
    this.scene.shadowsEnabled = q !== 'Low' && !!this.shadows;
  }
}
