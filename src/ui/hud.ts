import { Vector3 } from '../babylon';
import { MAP_NAMES, RULES } from '../config/game';
import type { Session } from '../logic/session';
import type { Player } from '../entities/player';
import type { Enemy } from '../entities/enemy';
import type { BattleMap } from '../world/map';

/** Minimap pixels per metre, the world half-extent of its static layer, and that layer's resolution. */
const MINI_SCALE=2.1, MINI_EXTENT=40, MINI_LAYER=512;
export class Hud {
  element=document.querySelector<HTMLElement>('#hud')!;
  mini:HTMLCanvasElement;
  notice=''; noticeTime=0; hitTime=0; hitHead=false; damageTime=0; damageAngle=0; killText=''; killTime=0;
  refreshTime=0;
  /** Bearing (relative to view) of the nearest live enemy grenade, or null. */
  grenadeAngle:number|null=null;
  constructor() {
    this.element.innerHTML=`<div class="smoke-overlay"></div><div class="damage-screen"></div><div class="damage-direction"></div><div class="mini-frame"><canvas width="180" height="180" aria-label="Minimap: gold A markers are available ammo boxes; white crosses are health packs"></canvas><div class="mini-caption">Tactical overview</div><div class="mini-legend"><span><b class="ammo-symbol">A</b> AMMO</span><span><b class="health-symbol">+</b> HEALTH</span></div></div><div class="hud-top"><div class="wave-tag"></div><div class="timer"></div></div><div class="hud-score"></div><div class="health-hud"><div class="health-label">VITALS</div><div class="stance-label"></div><div class="health-value"></div><div class="health-bar"><i></i></div></div><div class="weapon-hud"><div class="weapon-name"></div><div class="ammo-value"></div><div class="grenade-count"></div></div><div class="weapon-slots"></div><div class="crosshair"></div><div class="aim-dot"></div><div class="hitmarker">×</div><div class="grenade-warning hidden"><b>!</b><i></i></div><div class="status"></div><div class="message"></div><div class="interaction"></div><div class="kill-feed"></div><div class="dead-overlay hidden"></div><div class="pause-hint">ESC / PAUSE</div>`;
    this.mini=this.element.querySelector('canvas')!;
  }
  show(on:boolean) { this.element.classList.toggle('hidden',!on); }
  message(text:string) { this.notice=text; this.noticeTime=2.5; }
  hit(head=false) { this.hitTime=.22; this.hitHead=head; }
  kill(text:string) { this.killText=text; this.killTime=3; }
  damage(origin:Vector3,player:Player) { this.damageTime=.7; this.damageAngle=Math.atan2(origin.x-player.camera.position.x,origin.z-player.camera.position.z)-player.yaw; }
  set(selector:string,text:string) { this.element.querySelector(selector)!.innerHTML=text; }
  update(dt:number,s:Session,p:Player,map:BattleMap,enemies:Enemy[],reload:number,smoke:number) {
    this.minimap(p,map,enemies);
    this.refreshTime+=dt;
    if(dt>0&&this.refreshTime<.075) return;
    dt=this.refreshTime; this.refreshTime=0;
    this.noticeTime=Math.max(0,this.noticeTime-dt); this.hitTime=Math.max(0,this.hitTime-dt); this.damageTime=Math.max(0,this.damageTime-dt); this.killTime=Math.max(0,this.killTime-dt);
    const remaining=Math.ceil(s.remaining); this.set('.timer',`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`);
    this.set('.wave-tag',`Wave ${s.wave+1} / ${MAP_NAMES[s.wave]}`);
    this.set('.hud-score',`<b>${s.stats.total.score}</b> SCORE<br>${s.stats.total.kills} KILLS · ${enemies.filter(e=>e.alive).length} HOSTILES`);
    this.set('.health-value',`${Math.ceil(s.health)} <small>/ 1000</small>`);
    this.set('.stance-label',[p.crouched?'CROUCHED':'',Math.abs(p.lean)>.1?(p.lean<0?'LEAN LEFT':'LEAN RIGHT'):''].filter(Boolean).join(' · '));
    (this.element.querySelector('.health-bar i') as HTMLElement).style.width=`${s.health/10}%`;
    const inv=s.inventory,weapon=inv.weapon;
    this.set('.weapon-name',({rifle:'Assault rifle',pistol:'Sidearm',knife:'Combat knife',frag:'Fragmentation',smoke:'Smoke grenade'})[weapon]);
    const ammo=weapon==='rifle'||weapon==='pistol'?inv[weapon]:null;
    this.set('.ammo-value',ammo?`${String(ammo.loaded).padStart(2,'0')} <small>/ ${ammo.reserveRounds} <span>reserve</span></small>`:weapon==='frag'?`${inv.frag}`:weapon==='smoke'?`${inv.smoke}`:'—');
    this.set('.grenade-count',`FRAG ${inv.frag} · SMOKE ${inv.smoke}${ammo?` · ${ammo.capacity}-ROUND MAG`:''}`);
    this.set('.weapon-slots',(['rifle','pistol','knife','frag','smoke'] as const).map((w,i)=>`<span class="${w===weapon?'active':''}">${i+1} ${w.toUpperCase()}</span>`).join(''));
    this.set('.status',[reload>0?`RELOADING · ${reload.toFixed(1)}s`:'',s.protection>0?`SPAWN PROTECTION · ${Math.ceil(s.protection)}s`:''].filter(Boolean).join(' / '));
    this.element.querySelector('.status')!.classList.toggle('hidden',!(s.protection>0||reload>0));
    this.set('.message',this.notice); this.element.querySelector('.message')!.classList.toggle('hidden',!this.noticeTime);
    this.element.querySelector('.crosshair')!.classList.toggle('hidden',p.ads>.8);
    this.element.querySelector('.aim-dot')!.classList.toggle('hidden',p.ads<.8);
    const hit=this.element.querySelector<HTMLElement>('.hitmarker')!; hit.style.opacity=String(this.hitTime>0?1:0); hit.style.color=this.hitHead?'#e5b169':'#eee';
    this.element.querySelector<HTMLElement>('.damage-screen')!.style.opacity=String(this.damageTime*.65);
    const arc=this.element.querySelector<HTMLElement>('.damage-direction')!; arc.style.opacity=String(Math.min(1,this.damageTime*2)); arc.style.transform=`translate(-50%,-50%) rotate(${this.damageAngle}rad)`;
    this.element.querySelector<HTMLElement>('.smoke-overlay')!.style.opacity=String(smoke*.92);
    const warn=this.element.querySelector<HTMLElement>('.grenade-warning')!; warn.classList.toggle('hidden',this.grenadeAngle===null||s.state!=='Playing');
    if(this.grenadeAngle!==null){warn.style.transform=`translate(-50%,-50%) rotate(${this.grenadeAngle}rad) translateY(-92px)`;warn.firstElementChild!.setAttribute('style',`transform:rotate(${-this.grenadeAngle}rad)`);}
    this.set('.kill-feed',this.killTime?this.killText:'');
    const supply=map.supplies.find(a=>!a.used&&Vector3.Distance(a.position,p.camera.position)<RULES.interactionRange);
    this.element.querySelector('.interaction')!.classList.toggle('hidden',!supply||s.state!=='Playing');
    if(supply) this.set('.interaction',`[F] ${supply.kind==='health'?'Restore health':'Full ammunition resupply'} · single use`);
    const dead=this.element.querySelector<HTMLElement>('.dead-overlay')!; dead.classList.toggle('hidden',s.state!=='PlayerDead');
    if(s.state==='PlayerDead') dead.innerHTML=`<div><h2>YOU WERE KILLED</h2><p>Wave clock continues. No score penalty.<br>Returning to the battlefield in<strong>${Math.ceil(s.respawn)}</strong></p></div>`;
  }
  /** Player-centred, heading-up view: forward is always up, so left and right match the game. */
  private miniView={x:0,z:0,yaw:0};
  private miniLayer?:{canvas:HTMLCanvasElement;map:BattleMap;active:number};
  /** Canvas position of a world point on the minimap (as last drawn). */
  miniPoint(x:number,z:number):[number,number] {
    const v=this.miniView,dx=x-v.x,dz=z-v.z,c=Math.cos(v.yaw),s=Math.sin(v.yaw);
    return [90+(dx*c-dz*s)*MINI_SCALE,90-(dx*s+dz*c)*MINI_SCALE];
  }
  /** Supply markers stay visible: beyond the edge they sit on the rim, pointing the way. */
  miniMarker(x:number,z:number):[number,number] {
    const [u,v]=this.miniPoint(x,z), d=Math.hypot(u-90,v-90), r=80;
    return d>r?[90+(u-90)*r/d,90+(v-90)*r/d]:[u,v];
  }
  /** Walls and cover, drawn once per map in world space (north up) and rotated each frame. */
  private staticLayer(map:BattleMap) {
    const walls=map.nav.colliders.filter(c=>c.active&&c.top>1&&c.bottom<2);
    if(this.miniLayer?.map===map&&this.miniLayer.active===walls.length) return this.miniLayer.canvas;
    const canvas=this.miniLayer?.canvas??document.createElement('canvas'); canvas.width=canvas.height=MINI_LAYER;
    const ctx=canvas.getContext('2d')!, k=MINI_LAYER/(2*MINI_EXTENT); ctx.clearRect(0,0,MINI_LAYER,MINI_LAYER);
    ctx.strokeStyle='rgba(206,212,185,.35)'; ctx.lineWidth=2; ctx.strokeRect((MINI_EXTENT-map.nav.size)*k,(MINI_EXTENT-map.nav.size)*k,2*map.nav.size*k,2*map.nav.size*k);
    ctx.fillStyle='#626c5b';
    for(const c of walls) ctx.fillRect((MINI_EXTENT+c.x-c.w/2)*k,(MINI_EXTENT-c.z-c.d/2)*k,c.w*k,c.d*k);
    this.miniLayer={canvas,map,active:walls.length};
    return canvas;
  }
  minimap(p:Player,map:BattleMap,enemies:Enemy[]) {
    const ctx=this.mini.getContext('2d')!, body=p.bodyPosition, yaw=p.yaw;
    this.miniView={x:body.x,z:body.z,yaw};
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,180,180);
    ctx.save(); ctx.beginPath(); ctx.arc(90,90,89,0,Math.PI*2); ctx.clip();
    ctx.fillStyle='#16211c'; ctx.fillRect(0,0,180,180);
    // layer pixel (u,v) is world (u/k-E, E-v/k); rotate about the player so the view direction points up
    const k=MINI_LAYER/(2*MINI_EXTENT), c=Math.cos(yaw), s=Math.sin(yaw), S=MINI_SCALE/k;
    const [ox,oy]=this.miniPoint(-MINI_EXTENT,MINI_EXTENT);
    ctx.setTransform(S*c,-S*s,S*s,S*c,ox,oy);
    ctx.drawImage(this.staticLayer(map),0,0);
    ctx.setTransform(1,0,0,1,0,0);
    for(const sp of map.supplies) if(!sp.used) {
      const [x,z]=this.miniMarker(sp.position.x,sp.position.z);
      ctx.fillStyle='#16211c'; ctx.fillRect(x-7,z-7,14,14);
      if(sp.kind==='ammo') {
        ctx.fillStyle='#edcb72'; ctx.fillRect(x-6,z-6,12,12);
        ctx.fillStyle='#172119'; ctx.font='bold 10px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('A',x,z+.5);
      } else { ctx.fillStyle='#e4e7cc'; ctx.fillRect(x-4,z-1,8,2); ctx.fillRect(x-1,z-4,2,8); }
    }
    for(const e of enemies) if(e.alive) { const [x,z]=this.miniPoint(e.position.x,e.position.z); ctx.fillStyle=e.kind==='bomber'?'#ffa552':'#dc6858'; ctx.beginPath(); ctx.arc(x,z,2.6,0,Math.PI*2); ctx.fill(); }
    // you: always in the centre, facing up, with a faint view cone
    ctx.fillStyle='rgba(214,234,177,.12)'; ctx.beginPath(); ctx.moveTo(90,90); ctx.arc(90,90,60,-Math.PI/2-.5,-Math.PI/2+.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#d6eab1'; ctx.beginPath(); ctx.moveTo(90,82); ctx.lineTo(85,95); ctx.lineTo(90,92); ctx.lineTo(95,95); ctx.closePath(); ctx.fill();
    ctx.restore();
    // north marker on the rim
    const nx=90-Math.sin(yaw)*80, ny=90-Math.cos(yaw)*80;
    ctx.fillStyle='rgba(22,33,28,.85)'; ctx.beginPath(); ctx.arc(nx,ny,7,0,Math.PI*2); ctx.fill();
    ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#ced4b9'; ctx.fillText('N',nx,ny+.5);
  }
}
