import { RULES, type Difficulty } from '../config/game';
import { Inventory } from './inventory';
import { Statistics } from './statistics';
export type State = 'MainMenu' | 'WaveStarting' | 'Playing' | 'PlayerDead' | 'WaveComplete' | 'Paused' | 'GameComplete';
export class Session {
  state: State = 'MainMenu';
  previousState: State = 'Playing';
  wave = 0;
  elapsed = 0;
  health = RULES.health as number;
  respawn = 0;
  protection = 0;
  inventory = new Inventory();
  stats = new Statistics();
  replacements: number[] = [];
  supplies = new Set<string>();
  constructor(public difficulty: Difficulty = 'Normal') {}
  get remaining() { return Math.max(0, RULES.waveSeconds - this.elapsed); }
  get active() { return this.state === 'Playing' || this.state === 'PlayerDead'; }
  newGame() { this.wave = 0; this.stats = new Statistics(); this.startWave(); }
  startWave() {
    this.state = 'WaveStarting'; this.elapsed = 0; this.replacements = []; this.supplies.clear();
    this.stats.wave = this.wave; this.health = RULES.health; this.respawn = 0;
    this.inventory = new Inventory(); this.protection = RULES.protectionSeconds;
  }
  ready() { if (this.state === 'WaveStarting') this.state = 'Playing'; }
  nextWave() { if (this.state !== 'WaveComplete') return false; this.wave++; this.startWave(); return true; }
  tick(dt: number) {
    if (!this.active) return;
    this.elapsed = Math.min(RULES.waveSeconds, this.elapsed + Math.max(0, dt));
    this.protection = Math.max(0, this.protection - dt);
    if (this.remaining === 0) { this.state = this.wave === 2 ? 'GameComplete' : 'WaveComplete'; this.replacements = []; return; }
    if (this.state === 'PlayerDead') {
      this.respawn = Math.max(0, this.respawn - dt);
      if (this.respawn === 0) { this.health = RULES.health; this.inventory.refill(); this.inventory.weapon = 'rifle';
        this.protection = RULES.protectionSeconds; this.state = 'Playing'; }
    }
  }
  damage(amount: number, explosion = false) {
    if (this.state !== 'Playing' || this.protection > 0) return false;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    if (!this.health) { this.state = 'PlayerDead'; this.respawn = RULES.respawnSeconds; this.stats.death(explosion); }
    return true;
  }
  pause() { if (!this.active) return; this.previousState = this.state; this.state = 'Paused'; }
  resume() { if (this.state === 'Paused') this.state = this.previousState; }
  enemyDied() { if (this.active) this.replacements.push(this.elapsed + RULES.replacementSeconds); }
  takeReplacements() {
    if (!this.active) return 0;
    const ready = this.replacements.filter(t => t <= this.elapsed).length;
    this.replacements = this.replacements.filter(t => t > this.elapsed);
    return ready;
  }
  supply(id: string, kind: 'health' | 'ammo') {
    if (this.state !== 'Playing' || this.supplies.has(id)) return false;
    if (kind === 'health' && this.health === RULES.health) return false;
    this.supplies.add(id);
    if (kind === 'health') this.health = RULES.health; else this.inventory.refill();
    return true;
  }
}
