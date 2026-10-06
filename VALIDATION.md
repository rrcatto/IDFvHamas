# Validation: v1.00

Validated on 6 October 2026 in WSL Ubuntu with Node.js 24, Babylon.js 9.28.0, Havok 1.3.14, Vitest and Playwright.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` (strict TypeScript) | Pass |
| `npm test` (Vitest) | 51 / 51 pass: game rules, map layouts (spawn clearance, reachability, upper floors), and walk-through doorways on all three maps |
| Gameplay suite (`tests/browser/smoke.mjs`, Chromium, development build) | 20 / 20 pass: menus, settings, fullscreen, pointer lock and movement, all three waves, supplies, death and respawn, every enemy type, barrels and chain explosions, results, no console errors, no external requests |
| Cover and lean controls (`cover-controls.mjs`) | 8 / 8 pass |
| Weapon controls (`weapon-controls.mjs`) | 11 / 11 pass |
| Real mouse input (`mouse-input.mjs`) | Chromium 10 / 10. Firefox 10 / 10 on re-run; one earlier Firefox run timed out at the fullscreen step |
| Production build (`npm run build`) | Pass |

## Performance

Measured in Windows Chrome (Direct3D 11) on an RTX 3060 Laptop GPU at High quality and 1600×900, during a scripted session: walking, turning, enemy spawns, a barrel explosion and a grenade blast.
- About 70 fps median. Some runs paced at about 48 fps whether or not the shader warm-up was enabled.
- No frame over 170 ms during play.
- Loading takes about 8 seconds.

Explosions and burning barrels reuse lights created at load. Every shader a wave needs is compiled behind the loading screen. Together these removed the freezes of up to a second per explosion and the one to two seconds of stalls at the start of each wave.

## Limitations

- Characters and weapons are stylised low-poly CC0 models with realistic textures and lighting, not photo-scanned.
- A new enemy spawning mid-fight can still cause a frame of about 110–170 ms while its skeleton and animations are cloned.
- Texture detail and shadow-map resolution change only when the next map loads; other graphics settings apply immediately.
