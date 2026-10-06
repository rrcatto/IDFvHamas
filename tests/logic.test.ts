import { describe, expect, it } from 'vitest';
import { Session } from '../src/logic/session';
import { MagazineSet, Inventory } from '../src/logic/inventory';
import { Statistics, accuracy } from '../src/logic/statistics';
import { blastDamage, enemyHit, segmentSphere } from '../src/logic/damage';
import { DIFFICULTIES, RULES } from '../src/config/game';
import { Navigation } from '../src/world/navigation';
const playing = () => { const s=new Session(); s.newGame(); s.ready(); s.protection=0; return s; };
describe('wave and life state',()=>{
  it('ends exactly at 300 seconds, including while dead',()=>{const s=playing();s.tick(285);s.damage(1000);s.tick(15);expect(s.state).toBe('WaveComplete');expect(s.remaining).toBe(0);expect(s.health).toBe(0);});
  it('respawns after 15 seconds with full loadout and five seconds protection',()=>{const s=playing();s.inventory.rifle.fire();s.damage(1000);s.tick(14.99);expect(s.state).toBe('PlayerDead');expect(s.remaining).toBeCloseTo(285.01);s.tick(.01);expect(s.state).toBe('Playing');expect(s.health).toBe(1000);expect(s.inventory.rifle.total).toBe(150);expect(s.protection).toBe(5);expect(s.damage(1000)).toBe(false);s.tick(5);expect(s.damage(90)).toBe(true);});
  it('freezes both wave and respawn while paused',()=>{const s=playing();s.damage(1000);s.tick(3);s.pause();s.tick(50);expect(s.elapsed).toBe(3);expect(s.respawn).toBe(12);s.resume();expect(s.state).toBe('PlayerDead');s.tick(12);expect(s.state).toBe('Playing');});
  it('waits indefinitely between waves, then ends wave three',()=>{const s=playing();s.tick(300);s.tick(400);expect(s.wave).toBe(0);expect(s.elapsed).toBe(300);expect(s.nextWave()).toBe(true);expect(s.state).toBe('WaveStarting');expect(s.remaining).toBe(300);s.ready();s.tick(300);s.nextWave();s.ready();s.tick(300);expect(s.state).toBe('GameComplete');expect(s.nextWave()).toBe(false);});
  it('queues replacements at 30 seconds and cancels on wave end',()=>{const s=playing();s.enemyDied();s.tick(29.9);expect(s.takeReplacements()).toBe(0);s.tick(.1);expect(s.takeReplacements()).toBe(1);expect(s.takeReplacements()).toBe(0);s.tick(269);s.enemyDied();s.tick(1);expect(s.replacements).toEqual([]);});
  it('resets stats, supplies and loadout for a new session',()=>{const s=playing();s.stats.kill('rifle');s.supply('a','ammo');s.newGame();expect(s.stats.total.kills).toBe(0);expect(s.supplies.size).toBe(0);expect(s.inventory.pistol.total).toBe(45);});
});
describe('limited inventory and supplies',()=>{
  it('tops up without discarding or creating rounds',()=>{const m=new MagazineSet(30,5);for(let i=0;i<12;i++)m.fire();expect(m.total).toBe(138);expect(m.reload()).toBe(true);expect(m.loaded).toBe(30);expect(m.reserves).toContain(18);expect(m.total).toBe(138);expect(m.reload()).toBe(false);});
  it('fills the rifle even when each partial reserve has fewer rounds than the loaded magazine',()=>{const m=new MagazineSet(30,5);m.loaded=20;m.reserves=[4,5,3,1];expect(m.reload()).toBe(true);expect(m.loaded).toBe(30);expect(m.reserveRounds).toBe(3);expect(m.total).toBe(33);expect(m.reserves.every(n=>n>=0&&n<=30)).toBe(true);});
  it('fills the pistol from several partial reserves',()=>{const m=new MagazineSet(15,3);m.loaded=12;m.reserves=[2,1];expect(m.reload()).toBe(true);expect(m.loaded).toBe(15);expect(m.total).toBe(15);expect(m.reserveRounds).toBe(0);});
  it('uses every remaining round when too few remain for a full magazine',()=>{const m=new MagazineSet(30,5);m.loaded=2;m.reserves=[3,4,0,0];expect(m.reload()).toBe(true);expect(m.loaded).toBe(9);expect(m.total).toBe(9);expect(m.reserveRounds).toBe(0);expect(m.reload()).toBe(false);});
  it('cannot fire empty or exceed maximum carried ammunition',()=>{const m=new MagazineSet(15,3);for(let n=0;n<3;n++){for(let i=0;i<15;i++)expect(m.fire()).toBe(true);m.reload();}expect(m.total).toBe(0);expect(m.fire()).toBe(false);m.refill();expect(m.total).toBe(45);});
  it('grenades are finite and restored by one-time supplies',()=>{const s=playing();for(let i=0;i<3;i++)expect(s.inventory.consume('frag')).toBe(true);expect(s.inventory.consume('frag')).toBe(false);expect(s.supply('ammo-0','ammo')).toBe(true);expect(s.inventory.frag).toBe(3);expect(s.supply('ammo-0','ammo')).toBe(false);s.damage(300);expect(s.supply('health-0','health')).toBe(true);expect(s.health).toBe(1000);s.damage(90);expect(s.supply('health-0','health')).toBe(false);});
  it('does not consume health when full; preserves used supplies after death',()=>{const s=playing();expect(s.supply('h','health')).toBe(false);s.damage(20);expect(s.supply('h','health')).toBe(true);s.damage(1000);s.tick(15);expect(s.supplies.has('h')).toBe(true);});
});
describe('damage, difficulty and stats',()=>{
  it('requires three body hits or a headshot or proper knife hit',()=>{expect(enemyHit(enemyHit(enemyHit(3,false),false),false)).toBe(0);expect(enemyHit(3,true)).toBe(0);expect(enemyHit(3,false,true)).toBe(0);});
  it('uses radial falloff with no damage outside the radius',()=>{expect(blastDamage(0,8,1000)).toBe(1000);expect(blastDamage(4,8,1000)).toBe(500);expect(blastDamage(9,8,1000)).toBe(0);});
  it('gives 150 total for headshots and no death penalty',()=>{const s=new Statistics();s.kill('rifle',true);s.kill('knife');expect(s.total.score).toBe(250);s.death(true);expect(s.total.score).toBe(250);expect(s.total.streak).toBe(0);expect(s.total.bestStreak).toBe(2);expect(s.total.explosionDeaths).toBe(1);});
  it('maintains per-wave and overall firearm accuracy without grenade counts',()=>{const s=new Statistics();s.shot();s.shot();s.hit();s.kill('frag');expect(accuracy(s.total)).toBe(50);s.wave=1;s.shot();s.hit();s.kill('pistol',false,true);expect(s.waves[0].kills).toBe(1);expect(s.waves[1].bombers).toBe(1);expect(s.total.kills).toBe(2);expect(accuracy(s.total)).toBeCloseTo(66.6667);});
  it('difficulty changes reaction, cadence and accuracy rather than HP',()=>{expect(DIFFICULTIES.Easy.reaction).toBeGreaterThan(DIFFICULTIES.Hard.reaction);expect(DIFFICULTIES.Hard.accuracy).toBeLessThan(1);expect(RULES.bodyHealth).toBe(3);});
  it('detects line segments through smoke, including an observer inside it',()=>{expect(segmentSphere(-10,0,10,0,0,0,6)).toBe(true);expect(segmentSphere(0,0,20,20,0,0,6)).toBe(true);expect(segmentSphere(-10,9,10,9,0,0,6)).toBe(false);});
});
describe('collision and navigation',()=>{
  it('routes through a doorway and around cover without crossing walls',()=>{const n=new Navigation();n.colliders.push({x:0,z:0,w:1,d:8,bottom:0,top:4,active:true});const path=n.path({x:-4,z:0},{x:4,z:0});expect(path.length).toBeGreaterThan(10);expect(path.every(p=>n.clear(p.x,p.z,p.y))).toBe(true);expect(path.some(p=>Math.abs(p.z)>4)).toBe(true);});
  it('blocks player movement at a wall and releases destroyed cover',()=>{const n=new Navigation();const c={x:1,z:0,w:1,d:4,bottom:0,top:2,active:true};n.colliders.push(c);const p={x:0,z:0};n.move(p,3,0,0);expect(p.x).toBeLessThan(.5);c.active=false;n.move(p,3,0,0);expect(p.x).toBeGreaterThan(2);});
  it('supports ground-floor interiors beneath elevated slabs',()=>{const n=new Navigation();n.platforms.push({x:0,z:0,w:8,d:8,bottom:3.3,top:3.65,active:true});expect(n.ground(0,0,0)).toBe(0);expect(n.ground(0,0,3.65)).toBe(3.65);});
  it('prevents entering the high side of stairs and supports landing on low cover',()=>{const n=new Navigation();n.ramps.push({x:4,z:0,w:2,d:8,height:3.65});expect(n.clear(4,3,0)).toBe(false);expect(n.clear(4,-3.8,0)).toBe(true);n.colliders.push({x:0,z:0,w:2,d:2,bottom:0,top:1.2,active:true});expect(n.ground(0,0,0)).toBe(0);expect(n.ground(0,0,1)).toBe(1.2);});
});
