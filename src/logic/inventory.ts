import { WEAPONS, type Weapon } from '../config/game';
export class MagazineSet {
  loaded: number;
  reserves: number[];
  constructor(public readonly capacity: number, public readonly count: number) {
    this.loaded = capacity;
    this.reserves = Array(count - 1).fill(capacity);
  }
  get total() { return this.loaded + this.reserves.reduce((sum, n) => sum + n, 0); }
  get reserveRounds() { return this.total - this.loaded; }
  fire() { if (!this.loaded) return false; this.loaded--; return true; }
  reload() {
    let needed = Math.min(this.capacity - this.loaded, this.reserveRounds);
    if (needed <= 0) return false;
    // Top up from stored ammunition, including several partially used magazines.
    // Never create rounds: a short supply produces a partially filled magazine.
    while (needed > 0) {
      const index = this.reserves.indexOf(Math.max(...this.reserves));
      const rounds = Math.min(needed, this.reserves[index]);
      this.reserves[index] -= rounds;
      this.loaded += rounds;
      needed -= rounds;
    }
    return true;
  }
  refill() { this.loaded = this.capacity; this.reserves = Array(this.count - 1).fill(this.capacity); }
}
export class Inventory {
  rifle = new MagazineSet(WEAPONS.rifle.capacity, WEAPONS.rifle.magazines);
  pistol = new MagazineSet(WEAPONS.pistol.capacity, WEAPONS.pistol.magazines);
  frag = 3;
  smoke = 1;
  weapon: Weapon = 'rifle';
  refill() { this.rifle.refill(); this.pistol.refill(); this.frag = 3; this.smoke = 1; }
  consume(kind: 'frag' | 'smoke') { if (!this[kind]) return false; this[kind]--; return true; }
}
