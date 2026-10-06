import { Ray, Vector3 } from '../babylon';
import { WEAPONS, type KillSource, type Weapon } from '../config/game';
import type { Session } from '../logic/session';
import type { BattleMap, Prop } from '../world/map';
import type { EnemyManager } from './enemy-manager';
import type { Player } from './player';
import type { Projectiles } from './projectiles';
import type { Effects } from '../effects/effects';
import type { GameAudio } from '../audio';
import type { Hud } from '../ui/hud';
export class Weapons {
  cooldown=0;
  reloadTime=0;
  reloadDuration=1;
  private queuedPistolShot=false;
  private shotCount=0;
  onPropDamage?:(prop:Prop,damage:number,credited:boolean)=>void;
  constructor(public session:Session,public map:BattleMap,public player:Player,public enemies:EnemyManager,public projectiles:Projectiles,public effects:Effects,public audio:GameAudio,public hud:Hud) {}
  select(weapon:Weapon) { this.reloadTime=0; this.cancelFire(); if(weapon!==this.session.inventory.weapon) this.cooldown=0; this.session.inventory.weapon=weapon; this.player.view.select(weapon); this.audio.play('weapon_switch',undefined,.6); }
  cancelFire() { this.queuedPistolShot=false; }
  requestFire() {
    if(this.session.state!=='Playing'||this.reloadTime>0) return;
    if(this.session.inventory.weapon==='pistol'&&this.cooldown>0&&this.session.inventory.pistol.loaded>0) this.queuedPistolShot=true;
    else this.fire();
  }
  reload() {
    const kind=this.session.inventory.weapon;
    if(this.reloadTime||this.session.state!=='Playing'||!(kind==='rifle'||kind==='pistol')) return;
    const magazine=this.session.inventory[kind];
    if(magazine.loaded===magazine.capacity) { this.hud.message('Magazine already full'); return; }
    if(magazine.reserveRounds===0) { this.hud.message('No reserve ammo · find a gold A on the minimap'); return; }
    this.cancelFire();
    this.reloadDuration=WEAPONS[kind].reload; this.reloadTime=this.reloadDuration; this.audio.play(kind==='rifle'?'rifle_reload':'pistol_reload',undefined,.8);
  }
  update(dt:number) {
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.reloadTime>0) {
      this.reloadTime=Math.max(0,this.reloadTime-dt);
      if(this.reloadTime===0) { const w=this.session.inventory.weapon; if(w==='rifle'||w==='pistol') {
        const magazine=this.session.inventory[w]; magazine.reload();
        this.hud.message(magazine.loaded===magazine.capacity?`Reloaded · ${magazine.loaded}/${magazine.capacity}`:`Only ${magazine.loaded} rounds left · find a gold A on the minimap`);
      } }
    }
    if(this.queuedPistolShot&&this.cooldown===0) { this.queuedPistolShot=false; this.fire(); }
    if(this.player.fireHeld&&this.session.inventory.weapon==='rifle') this.fire();
  }
  fire() {
    if(this.session.state!=='Playing'||this.reloadTime>0||this.cooldown>0) return;
    const inv=this.session.inventory,w=inv.weapon,p=this.player.camera.position;
    const forward=this.player.forward();
    if(w==='frag'||w==='smoke') {
      this.cooldown=.7;
      if(!inv.consume(w)) { this.audio.play('dry_fire'); this.hud.message('No grenades remaining'); return; }
      this.projectiles.launch(w,p.add(forward.scale(.6)),forward.scale(13).add(new Vector3(0,3.6,0)),true);
      this.audio.play('grenade_throw',undefined,.8); this.player.view.throw(); return;
    }
    if(w==='knife') {
      this.cooldown=.55; this.audio.play('knife_swing_*',undefined,.8); this.player.view.swing();
      const hit=this.map.scene.pickWithRay(new Ray(p,forward,2.3),m=>!!m.metadata?.solid||!!m.metadata?.enemy?.alive);
      if(hit?.pickedMesh?.metadata?.enemy?.alive) { this.enemies.hit(hit.pickedMesh.metadata.enemy,false,'knife',true,hit.pickedPoint??undefined); this.hud.hit(); this.audio.play('knife_hit',undefined,.9); }
      else if(hit?.pickedMesh?.metadata?.prop) this.onPropDamage?.(hit.pickedMesh.metadata.prop,1,true);
      else if(hit?.hit&&hit.pickedPoint) { this.effects.impact(hit.pickedPoint,hit.pickedMesh?.metadata?.surface??'concrete',hit.getNormal(true)??undefined); this.audio.play('impact_concrete_*',hit.pickedPoint,.6); }
      return;
    }
    this.cooldown=WEAPONS[w].cadence;
    if(!inv[w].fire()) { this.audio.play('dry_fire'); this.hud.message('Empty magazine · press R'); this.cooldown=.4; return; }
    this.session.stats.shot(); this.audio.play(w==='rifle'?'rifle_fire_*':'pistol_fire_*',undefined,w==='rifle'?.8:.75,.97+Math.random()*.06);
    this.shotCount++;
    const spread=WEAPONS[w].spread*(this.player.adsHeld?.25:1)*(this.player.moving?1.5:1);
    const direction=forward.add(new Vector3((Math.random()-.5)*spread,(Math.random()-.5)*spread,(Math.random()-.5)*spread)).normalize();
    const hit=this.map.scene.pickWithRay(new Ray(p,direction,110),m=>!!m.metadata?.solid||!!m.metadata?.enemy?.alive);
    const endpoint=hit?.pickedPoint??p.add(direction.scale(80));
    const muzzle=this.player.view.muzzleWorld()??p.add(forward.scale(.6));
    if(w==='rifle'&&this.shotCount%3===0) this.effects.tracer(muzzle,endpoint,420);
    const metadata=hit?.pickedMesh?.metadata, normal=hit?.getNormal(true)??undefined;
    if(metadata?.enemy?.alive) {
      this.session.stats.hit(); const head=metadata.zone==='head'; this.enemies.hit(metadata.enemy,head,w,false,endpoint); this.hud.hit(head); this.audio.play('hitmarker',undefined,head?.5:.3,head?1.25:1);
    } else if(metadata?.prop) { this.onPropDamage?.(metadata.prop,1,true); this.effects.impact(endpoint,metadata.prop.kind==='barrel'?'metal':'wood',normal); this.audio.play(metadata.prop.kind==='barrel'?'impact_metal_*':'impact_wood_*',endpoint,.8); }
    else if(hit?.hit) {
      const surface=metadata?.surface??'concrete';
      this.effects.impact(endpoint,surface,normal); if(normal) this.effects.decal(endpoint,normal);
      this.audio.play(surface==='metal'?'impact_metal_*':surface==='wood'?'impact_wood_*':'impact_concrete_*',endpoint,.55,.9+Math.random()*.2);
    }
    this.player.view.shot(); this.player.pitch-=this.player.adsHeld?.005:.011; this.player.yaw+=(Math.random()-.5)*(this.player.adsHeld?.003:.006);
    this.effects.muzzleSmoke(muzzle,forward);
    const eject=this.player.view.ejectWorld();
    if(eject) { const right=Vector3.Cross(Vector3.Up(),forward).normalize(); this.effects.shell(eject,right,this.player.feet); if(Math.random()<.35) setTimeout(()=>this.audio.play('shell_casing',undefined,.35,.9+Math.random()*.3),380); }
  }
}
