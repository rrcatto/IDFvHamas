import { Vector3 } from './babylon';
import type { Settings } from './config/game';

/** Every bundled clip (public/assets/audio/<name>.ogg). `name_*` in play() picks a random variant. */
const SOUNDS = (
  'ak_far_1 ak_far_2 ak_near_1 ak_near_2 ak_near_3 ak_near_4 barrel_ignite bomber_beep bullet_whiz_1 bullet_whiz_2 dry_fire ' +
  'enemy_death_1 enemy_death_2 enemy_death_3 enemy_death_4 enemy_death_5 enemy_pain_1 enemy_pain_2 enemy_pain_3 enemy_pain_4 enemy_pain_5 ' +
  'enemy_pain_6 enemy_pain_7 enemy_pain_8 enemy_pain_9 enemy_shout_1 enemy_shout_2 enemy_shout_3 enemy_shout_4 enemy_shout_5 enemy_shout_6 ' +
  'enemy_throw epistol_far_1 epistol_far_2 epistol_near_1 epistol_near_2 explosion_1 explosion_2 explosion_distant explosion_small fire_loop ' +
  'grenade_bounce grenade_throw hitmarker impact_concrete_1 impact_concrete_2 impact_concrete_3 impact_flesh_1 impact_flesh_2 impact_flesh_3 ' +
  'impact_metal_1 impact_metal_2 impact_wood_1 impact_wood_2 knife_hit knife_swing_1 knife_swing_2 pickup_ammo pickup_health pistol_fire_1 ' +
  'pistol_fire_2 pistol_fire_3 pistol_reload player_death player_pain_1 player_pain_2 player_pain_3 player_pain_4 rifle_fire_1 rifle_fire_2 ' +
  'rifle_reload rocket_launch shell_casing step_1 step_2 step_3 step_4 step_5 step_gravel_1 step_gravel_2 step_gravel_3 ui_click ui_confirm weapon_switch'
).split(' ');
const LOOPS = ['music_combat', 'music_menu', 'ambience_wind', 'ambience_battle'];

export class GameAudio {
  context?: AudioContext;
  buffers = new Map<string, AudioBuffer>();
  master?: GainNode;
  effects?: GainNode;
  music?: GainNode;
  ambience?: GainNode;
  listener = new Vector3();
  private loaded?: Promise<void>;
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private variants = new Map<string, string[]>();
  private combat = false;
  private lastPlayed = new Map<string, number>();
  constructor(public settings: Settings) {
    for (const s of SOUNDS) { const m = s.match(/^(.*)_\d+$/); if (m) { const v = this.variants.get(m[1]) ?? []; v.push(s); this.variants.set(m[1], v); } }
  }
  private async fetchBuffer(name: string) {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/${name}.ogg`);
    if (!response.ok) throw new Error(`Audio asset missing: ${name}`);
    this.buffers.set(name, await this.context!.decodeAudioData(await response.arrayBuffer()));
  }
  async unlock() {
    if (!this.context) {
      const ctx = this.context = new AudioContext();
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      // gentle bus compression keeps stacked gunfire and explosions from clipping
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
      this.effects = ctx.createGain(); this.effects.connect(comp); comp.connect(this.master);
      this.music = ctx.createGain(); this.music.connect(this.master);
      this.ambience = ctx.createGain(); this.ambience.connect(this.master);
      this.update(false);
      // short effects first so gameplay sounds are ready quickly; long loops stream in after
      this.loaded = Promise.all(SOUNDS.map(n => this.fetchBuffer(n))).then(async () => {
        await Promise.all(LOOPS.map(n => this.fetchBuffer(n).catch(e => console.warn(e))));
        for (const n of LOOPS) this.startLoop(n);
        this.update(this.combat);
      }).catch(e => console.error('Audio loading failed', e));
    }
    // Resume immediately; clips keep decoding in the background and play once ready.
    await this.context.resume();
  }
  /** Resolves when every clip has been decoded (used by tests). */
  get ready() { return this.loaded ?? Promise.resolve(); }
  private startLoop(name: string) {
    const ctx = this.context!, buffer = this.buffers.get(name); if (!buffer || this.loops.has(name)) return;
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(gain); gain.connect(name.startsWith('music') ? this.music! : this.ambience!);
    src.start(0, Math.random() * Math.max(0, buffer.duration - 1));
    this.loops.set(name, { src, gain });
  }
  /** Mix state: combat plays the combat score and battle ambience; menus soften to the menu theme. */
  update(combat: boolean) {
    this.combat = combat;
    const ctx = this.context; if (!ctx) return;
    const t = ctx.currentTime;
    this.master!.gain.setTargetAtTime(this.settings.master, t, 0.05);
    this.effects!.gain.setTargetAtTime(this.settings.effects, t, 0.05);
    this.music!.gain.setTargetAtTime(this.settings.music, t, 0.05);
    this.ambience!.gain.setTargetAtTime(this.settings.effects * 0.8, t, 0.05);
    const level = (name: string, v: number) => this.loops.get(name)?.gain.gain.setTargetAtTime(v, t, 0.8);
    level('music_combat', combat ? 0.85 : 0); level('music_menu', combat ? 0 : 0.7);
    level('ambience_wind', combat ? 0.55 : 0.35); level('ambience_battle', combat ? 0.5 : 0.12);
  }
  play(name: string, position?: Vector3, volume = 1, pitch = 1) {
    const ctx = this.context;
    if (name.endsWith('_*')) { const v = this.variants.get(name.slice(0, -2)); if (!v) return; name = v[Math.floor(Math.random() * v.length)]; }
    const buffer = this.buffers.get(name);
    if (!ctx || !buffer || ctx.state !== 'running') return;
    // avoid identical clips stacking on the same frame (e.g. several impacts at once)
    const now = ctx.currentTime, last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.012) return; this.lastPlayed.set(name, now);
    const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = pitch;
    const gain = ctx.createGain(); gain.gain.value = volume; source.connect(gain);
    if (position) {
      const pan = ctx.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 4; pan.maxDistance = 90; pan.rolloffFactor = 1.15;
      // Web Audio is right-handed, Babylon left-handed: mirror Z so left/right are correct
      if (pan.positionX) { pan.positionX.value = position.x; pan.positionY.value = position.y; pan.positionZ.value = -position.z; }
      else pan.setPosition(position.x, position.y, -position.z);
      gain.connect(pan); pan.connect(this.effects!); source.onended = () => { gain.disconnect(); pan.disconnect(); };
    } else { gain.connect(this.effects!); source.onended = () => gain.disconnect(); }
    source.start();
  }
  position(position: Vector3, forward: Vector3) {
    this.listener.copyFrom(position);
    const l = this.context?.listener; if (!l) return;
    if (l.positionX) {
      l.positionX.value = position.x; l.positionY.value = position.y; l.positionZ.value = -position.z;
      l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = -forward.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(position.x, position.y, -position.z); l.setOrientation(forward.x, forward.y, -forward.z, 0, 1, 0); }
  }
}
