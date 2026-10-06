// This module is imported only inside the development-only branch.
import { Vector3 } from './babylon';
import type { Game } from './game';
export function installTestHooks(game: Game) {
    (window as unknown as {__gameTest:unknown}).__gameTest={
      game, snapshot:()=>({state:game.session.state,wave:game.session.wave,remaining:game.session.remaining,health:game.session.health,respawn:game.session.respawn,protection:game.session.protection,ammo:game.session.inventory.rifle.total,stats:game.session.stats.total,enemies:game.enemies.enemies.filter(e=>e.alive).map(e=>({id:e.id,kind:e.kind,x:e.position.x,y:e.position.y,z:e.position.z})),supplies:game.map.supplies.map(s=>({id:s.id,kind:s.kind,used:s.used})),fps:game.engine.getFps()}),
      advance:(seconds:number)=>{ for(let t=0;t<seconds;t+=.05) game.update(Math.min(.05,seconds-t)); game.previousTime=performance.now(); },
      elapse:(seconds:number)=>{ game.update(seconds); game.previousTime=performance.now(); },
      damage:(amount:number)=>{ game.session.protection=0; game.damagePlayer(amount,new Vector3(8,1,0),true); },
      teleport:(x:number,z:number,y=0)=>game.player.spawn({x,z,y}),
      aimEnemy:(id:number,head:boolean)=>{ const enemy=game.enemies.enemies.find(e=>e.id===id)!; enemy.root.computeWorldMatrix(true); for (const n of enemy.root.getDescendants(false)) (n as unknown as {computeWorldMatrix:(f:boolean)=>void}).computeWorldMatrix(true); const box=head?enemy.head:enemy.body; const target=box.getAbsolutePosition().clone(),v=target.subtract(game.player.camera.position); game.player.yaw=Math.atan2(v.x,v.z); game.player.pitch=-Math.atan2(v.y,Math.hypot(v.x,v.z)); game.player.camera.rotation.set(game.player.pitch,game.player.yaw,0); game.player.camera.getViewMatrix(true); },
      fire:()=>{ game.weapons.cooldown=0; game.weapons.fire(); },
      spawn:(kind:'pistol'|'rifle'|'rocket'|'bomber')=>game.enemies.spawn(kind)?.id,
    };
}
