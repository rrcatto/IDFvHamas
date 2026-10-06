import type { KillSource } from '../config/game';
export function blankStats() {
  return { kills: 0, deaths: 0, score: 0, shotsFired: 0, shotsHit: 0, headshots: 0,
    rifle: 0, pistol: 0, knife: 0, frag: 0, environment: 0, bombers: 0,
    explosionDeaths: 0, streak: 0, bestStreak: 0 };
}
export type Stats = ReturnType<typeof blankStats>;
export function accuracy(s: Stats) { return s.shotsFired ? s.shotsHit / s.shotsFired * 100 : 0; }
export class Statistics {
  total = blankStats();
  waves = [blankStats(), blankStats(), blankStats()];
  wave = 0;
  private each(fn: (s: Stats) => void) { fn(this.total); fn(this.waves[this.wave]); }
  shot() { this.each(s => s.shotsFired++); }
  hit() { this.each(s => s.shotsHit++); }
  kill(source: KillSource, head = false, bomber = false) {
    this.each(s => { s.kills++; s.score += head ? 150 : 100; s[source]++;
      if (head) s.headshots++; if (bomber) s.bombers++;
      s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); });
  }
  death(explosion = false) { this.each(s => { s.deaths++; s.streak = 0; if (explosion) s.explosionDeaths++; }); }
}
