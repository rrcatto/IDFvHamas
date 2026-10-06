import { Engine, HavokPlugin, Scene, Vector3, type AbstractMesh, type ParticleSystem } from './babylon';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import HavokPhysics from '@babylonjs/havok';
import havokUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import { DEFAULT_SETTINGS, RULES, type KillSource } from './config/game';
import { MAP_NAMES } from './config/maps';
import { GameAudio } from './audio';
import { AssetLibrary, type ModelName } from './assets';
import { Session } from './logic/session';
import { blastDamage } from './logic/damage';
import { BattleMap, MAP_MODELS, type Prop } from './world/map';
import { Player } from './entities/player';
import { EnemyManager } from './entities/enemy-manager';
import { Enemy, FighterTemplate } from './entities/enemy';
import { Projectiles } from './entities/projectiles';
import { Weapons } from './entities/weapons';
import { Effects } from './effects/effects';
import { Menus, type MenuAction } from './ui/menus';
import { Hud } from './ui/hud';

export class Game {
  engine: Engine;
  session = new Session();
  settings = { ...DEFAULT_SETTINGS };
  menus = new Menus(this.settings);
  hud = new Hud();
  audio = new GameAudio(this.settings);
  assets = new AssetLibrary();
  scene!: Scene;
  map!: BattleMap;
  player!: Player;
  enemies!: EnemyManager;
  projectiles!: Projectiles;
  effects!: Effects;
  weapons!: Weapons;
  havok!: Awaited<ReturnType<typeof HavokPhysics>>;
  loading = false;
  previousTime = performance.now();
  private frozen = new Map<ParticleSystem, number>();
  private menuTime = 0;
  private deathRoll = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, powerPreference: 'high-performance' }, true);
    this.menus.onAction = action => void this.action(action);
    window.addEventListener('resize', () => this.engine.resize());
    document.addEventListener('keydown', e => this.key(e, true)); document.addEventListener('keyup', e => this.key(e, false));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // Babylon prevents pointerdown's default action, which can suppress legacy
    // mousedown events. Read native pointer events before the scene processes them.
    // A mouse's second button press/release arrives as pointermove, so use the
    // complete buttons mask to support firing and ADS together in either order.
    const pointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || document.pointerLockElement !== canvas || this.session.state !== 'Playing') return;
      if (e.type === 'pointermove') {
        this.player.look(e.movementX, e.movementY);
        // Normal locked movement has button=-1. It does not change buttons;
        // Chromium can report buttons=0 here even while a button remains held.
        if (e.button === -1) return;
      }
      const fire = !!(e.buttons & 1), wasFiring = this.player.fireHeld;
      this.player.adsHeld = !!(e.buttons & 2);
      this.player.fireHeld = fire;
      if (fire && !wasFiring) this.weapons.requestFire();
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, pointer as EventListener, { capture: true });
    document.addEventListener('pointercancel', e => {
      if (e.pointerType !== 'mouse' || !this.player) return;
      this.player.fireHeld = false; this.player.adsHeld = false; this.weapons.cancelFire();
    }, { capture: true });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.session.active) this.pause(); });
    window.addEventListener('blur', () => this.pause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
  }
  async init() {
    this.menus.loading('IDF v Hamas', 'Loading assets…');
    this.assets.onProgress = f => this.menus.progress(f);
    this.havok = await HavokPhysics({ locateFile: () => havokUrl });
    await this.createWorld(0);
    this.menuCamera();
    this.menus.main(); this.hud.show(false);
    this.previousTime = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now(), dt = Math.max(0, (now - this.previousTime) / 1000); this.previousTime = now;
      if (this.loading || !this.scene) return;
      this.update(dt); this.scene.render();
    });
    void this.assets.prefetch().catch(e => console.warn('Background prefetch failed', e));
    if (import.meta.env.DEV) { const { installTestHooks } = await import('./testing'); installTestHooks(this); }
  }
  private menuCamera() {
    this.player.camera.position.set(-2, 10.5, -31); this.player.yaw = 0.42; this.player.pitch = 0.2;
  }
  async createWorld(index: number) {
    this.scene?.dispose();
    const scene = this.scene = new Scene(this.engine);
    scene.skipPointerMovePicking = true;
    scene.enablePhysics(new Vector3(0, -9.8, 0), new HavokPlugin(true, this.havok));
    const names: ModelName[] = ['fighter', 'viewmodel', ...MAP_MODELS];
    const models = await this.assets.containers(scene, names);
    for (const c of Object.values(models)) {
      c.addAllToScene();
      for (const n of c.rootNodes) n.setEnabled(false);
      for (const g of c.animationGroups) g.stop();
    }
    this.player = new Player(scene, this.canvas, this.settings);
    this.player.onStep = () => this.audio.play(this.map.index === 1 || this.map.index === 2 ? (Math.random() < .5 ? 'step_*' : 'step_gravel_*') : 'step_*', undefined, .3, .92 + Math.random() * .16);
    this.map = new BattleMap(scene, index, this.player.camera, this.settings.quality, models);
    this.map.batchStaticGeometry();
    this.map.createPhysics();
    this.player.attachView(models.viewmodel, this.map.env.fx);
    this.effects = new Effects(scene, this.map.env.fx, this.player.camera, this.map.materials);
    this.effects.onShake = (amount, at) => this.player.shake(amount * Math.max(0, 1 - Vector3.Distance(at, this.player.camera.position) / 24) * 0.9);
    this.projectiles = new Projectiles(scene, this.effects, this.audio);
    const vm = models.viewmodel;
    if (vm) for (const k of ['frag', 'smoke'] as const) {
      const mesh = vm.meshes.find(m => m.name === `Proj_${k === 'frag' ? 'Frag' : 'Smoke'}`) as AbstractMesh | undefined;
      if (mesh) this.projectiles.templates[k] = mesh;
    }
    this.projectiles.playerPosition = () => this.player.camera.position;
    this.enemies = new EnemyManager(this.map, this.session, this.player, this.projectiles, this.effects, this.audio, new FighterTemplate(scene, models.fighter));
    this.weapons = new Weapons(this.session, this.map, this.player, this.enemies, this.projectiles, this.effects, this.audio, this.hud);
    this.weapons.onPropDamage = (p, d, c) => this.damageProp(p, d, c);
    this.projectiles.onBlast = (p, r, d, s, c) => this.explode(p, r, d, s, c);
    this.enemies.onExplosion = (p, r, d, s, c) => this.explode(p, r, d, s, c);
    this.enemies.onPlayerDamage = (amount, p, explosion) => this.damagePlayer(amount, p, explosion);
    this.enemies.onKill = (_e, source, head) => this.hud.kill(`${head ? 'HEADSHOT' : 'HOSTILE DOWN'} · +${head ? 150 : 100} · ${source.toUpperCase()}`);
    this.applySettings();
    await scene.whenReadyAsync();
  }
  async action(action: MenuAction) {
    if (action === 'fullscreen') { await this.fullscreen(); return; }
    if (action === 'settings-changed') { this.applySettings(); return; }
    this.audio.play('ui_click', undefined, .7);
    if (action === 'play' || action === 'restart') {
      this.session = new Session(this.menus.difficulty); this.session.newGame(); await this.beginWave();
    } else if (action === 'next') { if (this.session.nextWave()) await this.beginWave(); }
    else if (action === 'resume') {
      await this.requestLock(); await this.audio.unlock(); this.session.resume(); this.player.clearInput(); this.menus.hide(); this.audio.update(true); this.freeze(false);
    } else if (action === 'quit') {
      this.session.state = 'MainMenu'; this.player.clearInput(); this.weapons.cancelFire(); if (document.pointerLockElement) document.exitPointerLock();
      this.freeze(false); this.menus.main(); this.hud.show(false); this.audio.update(false);
    }
  }
  async beginWave() {
    const lock = this.requestLock(); void this.audio.unlock().catch(e => console.error('Audio initialization failed', e));
    this.loading = true; this.menus.loading(MAP_NAMES[this.session.wave], 'Building the battlefield…');
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    this.frozen.clear();
    await this.createWorld(this.session.wave); this.player.spawn(this.map.playerSpawns[0]); this.enemies.populate();
    await this.warmUp();
    this.session.ready(); this.loading = false; this.previousTime = performance.now(); this.menus.hide(); this.hud.show(true); this.audio.update(true);
    this.hud.message(`Wave ${this.session.wave + 1} · ${MAP_NAMES[this.session.wave]}`);
    await lock;
    if (document.pointerLockElement !== this.canvas) this.pause();
  }
  /**
   * Compile every shader the wave can need while the loading screen is still up. Babylon compiles a
   * shader the first time something is drawn with it, which stalled the first seconds of play and the
   * first appearance of each enemy type, decal, debris piece and projectile.
   */
  private async warmUp() {
    const spares = (['pistol', 'rifle', 'rocket', 'bomber'] as const).map((kind, i) => {
      const e = new Enemy(this.scene, kind, new Vector3(i * 2 - 3, -30, 0), -1 - i, this.enemies.template);
      for (const m of e.meshes) this.map.env.caster(m, false);
      return e;
    });
    const undo = this.effects.warmUp(), models = this.projectiles.warmUpModels();
    await this.scene.whenReadyAsync();
    // a few frames finish the post-processing, particle and shadow-pass programs
    for (let i = 0; i < 3; i++) { this.scene.render(); await new Promise<void>(r => requestAnimationFrame(() => r())); }
    for (const e of spares) e.dispose();
    undo(); for (const m of models) m.dispose();
  }
  async requestLock() {
    try { await this.canvas.requestPointerLock(); return true; }
    catch { return false; }
  }
  async fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); this.engine.resize(); }
    catch { this.hud.message('Fullscreen unavailable in this browser window'); }
  }
  /** Freeze particles while paused so smoke and fire do not drift behind the menu. */
  private freeze(on: boolean) {
    if (!this.scene) return;
    if (on) { for (const ps of this.scene.particleSystems) if (!this.frozen.has(ps as ParticleSystem)) { this.frozen.set(ps as ParticleSystem, ps.updateSpeed); ps.updateSpeed = 0; } }
    else { for (const [ps, s] of this.frozen) ps.updateSpeed = s; this.frozen.clear(); }
  }
  pause() {
    if (!this.session.active) return;
    this.session.pause(); this.player.clearInput(); this.weapons.cancelFire(); if (document.pointerLockElement) document.exitPointerLock(); this.menus.pause(); this.audio.update(false);
    this.freeze(true);
  }
  key(e: KeyboardEvent, down: boolean) {
    if (['Space', 'ControlLeft', 'ControlRight', 'Tab'].includes(e.code) && this.session.active) e.preventDefault();
    if (down && !e.repeat && e.code === 'Escape') { this.pause(); return; }
    if (down && e.code === 'Enter' && this.session.state === 'WaveComplete') { void this.action('next'); return; }
    if (this.session.state !== 'Playing' || document.pointerLockElement !== this.canvas) return;
    if (down) this.player.keys.add(e.code); else this.player.keys.delete(e.code);
    if (!down || e.repeat) return;
    const index = Number(e.code.replace('Digit', '')) - 1;
    if (index >= 0 && index < 5) this.weapons.select((['rifle', 'pistol', 'knife', 'frag', 'smoke'] as const)[index]);
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.player.toggleCrouch();
    if (e.code === 'KeyR') this.weapons.reload(); if (e.code === 'KeyF') this.interact();
  }
  interact() {
    const supply = this.map.supplies.find(s => !s.used && Vector3.Distance(s.position, this.player.camera.position) < RULES.interactionRange);
    if (!supply) return;
    if (this.session.supply(supply.id, supply.kind)) {
      supply.used = true; supply.mesh.setEnabled(false);
      this.audio.play(supply.kind === 'health' ? 'pickup_health' : 'pickup_ammo', undefined, .9);
      this.hud.message(supply.kind === 'health' ? 'Health restored · 1000 HP' : 'Full loadout restored');
    } else this.hud.message('Health already full');
  }
  damagePlayer(amount: number, origin: Vector3, explosion: boolean) {
    if (amount <= 0) return;
    if (!this.session.damage(amount, explosion)) return;
    this.hud.damage(origin, this.player); this.audio.play(this.session.health > 0 ? 'player_pain_*' : 'player_death', undefined, .55);
    this.player.shake(explosion ? 0.5 : 0.12);
    if (this.session.state === 'PlayerDead') { this.player.clearInput(); this.weapons.cancelFire(); this.weapons.reloadTime = 0; }
  }
  damageProp(p: Prop, amount: number, credited: boolean) {
    if (p.destroyed) return;
    p.credited ||= credited;
    if (p.warning >= 0) { if (p.kind === 'barrel') p.warning = Math.min(p.warning, 0.2); return; }
    p.health -= amount;
    if (p.health <= 0) {
      if (p.kind === 'barrel') {
        // ruptured drum catches fire, hisses, then explodes
        p.warning = 1.6; p.burning = this.effects.burn(p.position);
        this.audio.play('barrel_ignite', p.position, 1); this.audio.play('fire_loop', p.position, .8);
      } else this.destroy(p);
    } else if (p.kind === 'barrel') this.effects.impact(p.position.add(new Vector3(0, .6, 0)), 'metal');
  }
  destroy(p: Prop) {
    if (p.destroyed) return; p.destroyed = true; p.collider.active = false;
    for (const m of p.parts) { m.metadata = { ...m.metadata, solid: false }; m.isPickable = false; }
    p.root.setEnabled(false); p.burning?.stop();
    this.effects.fragments(p.position, p.kind);
    if (p.kind === 'crate') this.audio.play('impact_wood_*', p.position, 1, .8);
  }
  explode(position: Vector3, radius: number, maximum: number, source: KillSource, credited: boolean) {
    if (!this.session.active) return;
    const big = maximum >= 1400;
    this.effects.explosion(position, big ? 1.5 : 1.1); this.effects.scorch(position, big ? 4.5 : 3.2);
    const far = Vector3.Distance(position, this.player.camera.position) > 35;
    this.audio.play(far ? 'explosion_distant' : big ? 'explosion_2' : 'explosion_1', position, 1.2, .94 + Math.random() * .12);
    const eye = this.player.camera.position, at = position.add(new Vector3(0, .3, 0));
    const playerDistance = Vector3.Distance(position, eye);
    const playerCover = this.enemies.visible(at, eye) ? 1 : .25;
    this.damagePlayer(blastDamage(playerDistance, radius, maximum) * playerCover, position, true);
    for (const e of this.enemies.enemies) if (e.alive) {
      const centre = e.position.add(new Vector3(0, 1, 0)), distance = Vector3.Distance(position, centre);
      const cover = this.enemies.visible(at, centre) ? 1 : .3;
      const damage = blastDamage(distance, radius, maximum) * cover / 110;
      e.health -= damage; if (damage > 0) e.hit(false);
      if (e.health <= 0) this.enemies.kill(e, source, credited);
      if (distance < radius) { const impulse = e.position.subtract(position).normalize().scale(.4); this.map.nav.move(e.position, impulse.x, impulse.z, e.position.y, .28); }
    }
    for (const p of this.map.props) if (!p.destroyed) this.damageProp(p, blastDamage(Vector3.Distance(position, p.position), radius, maximum) / 120, credited);
  }
  update(realDt: number) {
    if (this.loading || !this.scene) return;
    const dt = Math.min(realDt, .1), previous = this.session.state;
    this.scene.physicsEnabled = this.session.active;
    if (this.session.active) {
      this.session.tick(realDt);
      if (!this.session.active) {
        this.player.clearInput(); this.weapons.cancelFire(); this.scene.physicsEnabled = false;
        if (document.pointerLockElement) document.exitPointerLock(); this.menus.results(this.session); this.audio.update(false);
      } else {
        if (previous === 'PlayerDead' && this.session.state === 'Playing') { this.player.spawn(this.enemies.safePlayerSpawn()); this.weapons.select('rifle'); this.hud.message('Respawned · 5 seconds protection'); }
        this.player.update(dt, this.map.nav, this.session.state === 'Playing', this.session.inventory.weapon, this.weapons.reloadTime / this.weapons.reloadDuration);
        if (this.session.state === 'PlayerDead') {
          // slump to the ground while the respawn timer runs
          const cam = this.player.camera; cam.position.y += (this.player.feet + 0.35 - cam.position.y) * Math.min(1, dt * 3);
          this.deathRoll += (0.45 - this.deathRoll) * Math.min(1, dt * 3); cam.rotation.z = this.deathRoll; this.player.view.root.setEnabled(false);
        } else { this.deathRoll = 0; this.player.view.root.setEnabled(true); }
        if (this.session.state === 'Playing') this.weapons.update(dt);
        this.enemies.update(dt); this.projectiles.update(dt); this.effects.update(dt);
        const cam = this.player.camera.position; let near: Vector3 | null = null, best = 9;
        for (const p of this.projectiles.items) if (!p.player && p.kind === 'frag') { const d = Vector3.Distance(p.mesh.position, cam); if (d < best) { best = d; near = p.mesh.position; } }
        this.hud.grenadeAngle = near ? Math.atan2(near.x - cam.x, near.z - cam.z) - this.player.yaw : null;
        for (const p of this.map.props) if (p.warning >= 0 && !p.destroyed) {
          p.warning -= dt;
          if (p.warning <= 0) { this.destroy(p); this.explode(p.position.add(new Vector3(0, .5, 0)), 9, 1500, 'environment', p.credited); }
        }
      }
    } else if (this.session.state === 'MainMenu') {
      this.menuTime += realDt;
      this.player.yaw = 0.42 + Math.sin(this.menuTime * 0.05) * 0.35; this.player.pitch = 0.2 + Math.sin(this.menuTime * 0.07) * 0.04;
      this.player.camera.rotation.set(this.player.pitch, this.player.yaw, 0);
      this.player.view?.root.setEnabled(false);
      this.effects?.update(dt);
    }
    this.map.env.update(dt);
    this.audio.position(this.player.camera.position, this.player.forward());
    if (this.session.state !== 'MainMenu') this.hud.update(this.session.state === 'Paused' ? 0 : dt, this.session, this.player, this.map, this.enemies.enemies, this.weapons.reloadTime, this.effects.density(this.player.camera.position));
  }
  applySettings() {
    this.audio.update(this.session.active);
    if (!this.map) return;
    const q = this.settings.quality;
    this.player.camera.fov = (this.settings.fov - this.player.ads * 27) * Math.PI / 180;
    this.engine.setHardwareScalingLevel(q === 'Low' ? 1.6 : q === 'Medium' ? 1.2 : 1);
    this.effects.budgetScale = q === 'Low' ? .4 : q === 'Medium' ? .7 : 1;
    this.map.env.setQuality(q);
    this.engine.resize();
  }
}
