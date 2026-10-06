export const RULES = {
  health: 1000, waveSeconds: 300, respawnSeconds: 15, protectionSeconds: 5,
  replacementSeconds: 30, corpseSeconds: 120, bodyHealth: 3,
  walkSpeed: 4.2, sprintSpeed: 6.8, crouchSpeed: 2.2, jumpSpeed: 5.5,
  gravity: 16, playerRadius: 0.32, eyeHeight: 1.65, crouchEyeHeight: 1.06,
  leanDistance: 0.46, leanRoll: 0.20, leanSpeed: 10, leanHeadRadius: 0.12,
  grenadeFuse: 2.6, grenadeRadius: 8, grenadeDamage: 1150,
  rocketRadius: 9, rocketDamage: 1450, bomberRadius: 9, bomberDamage: 1500,
  smokeSeconds: 24, smokeRadius: 6, interactionRange: 2.8,
} as const;
export const WEAPONS = {
  rifle: { capacity: 30, magazines: 5, reload: 2.3, cadence: 0.105, spread: 0.012, damage: 1 },
  pistol: { capacity: 15, magazines: 3, reload: 1.6, cadence: 0.24, spread: 0.009, damage: 1 },
};
export type Difficulty = 'Easy' | 'Normal' | 'Hard';
export const DIFFICULTIES = {
  Easy: { reaction: 1.5, accuracy: 0.24, cadence: 1.3, aggression: 0.8, grenadeInterval: 32, damage: 0.8 },
  Normal: { reaction: 0.9, accuracy: 0.40, cadence: 1, aggression: 1, grenadeInterval: 23, damage: 1 },
  Hard: { reaction: 0.55, accuracy: 0.54, cadence: 0.8, aggression: 1.15, grenadeInterval: 17, damage: 1.12 },
};
export { MAP_NAMES } from './maps';
export type Weapon = 'rifle' | 'pistol' | 'knife' | 'frag' | 'smoke';
export type KillSource = Exclude<Weapon, 'smoke'> | 'environment';
export type Settings = { master: number; effects: number; music: number; sensitivity: number; fov: number; quality: 'Low' | 'Medium' | 'High' };
export const DEFAULT_SETTINGS: Settings = { master: 0.8, effects: 0.85, music: 0.22, sensitivity: 1, fov: 80, quality: 'High' };
