# Changelog

## v1.00 (6 October 2026)

First public release of IDF v Hamas, a single-player first-person shooter for desktop browsers built with Babylon.js.

### Gameplay
- A campaign of three five-minute waves, one per map, against continuously reinforced enemies.
- Unlimited lives with a 15-second respawn and five seconds of spawn protection. The wave clock keeps running while you are down.
- Limited ammunition. Each map has five health packs and two ammunition crates, and each can be used once.
- Scoring: 100 per kill, 150 per headshot, with no penalty for dying. Each wave has its own results screen, and the campaign ends with overall results.
- Three difficulty levels.

### Maps
- **Market Quarter**: a market square with stalls, a canopy and a dry fountain, narrow lanes, a covered footbridge, roller-shuttered shops, a roofless ruin and a collapsed corner, under harsh midday sun and dust.
- **Residential District**: apartment blocks with balconies along a wrecked boulevard, walled courtyards, a pancaked building, a checkpoint and craters, in late-afternoon golden haze.
- **Ruined Crossing**: a broken highway overpass with a climbable collapsed span, a T-wall checkpoint and sandbag bunker, a wrecked gas station, a hotel and a warehouse, under an overcast sky with smoke columns, falling ash and burning wrecks.
- Two-storey buildings throughout:
  - framed doorways and walk-in shopfronts;
  - internal or external stairs;
  - balconies, firing windows, shell holes, bullet strikes and scorch marks.
- Doorways have clear approaches.
- Every enemy spawn point, supply and upper floor is reachable.

### Enemies
- Rigged, animated fighters in camouflage, olive, black or desert fatigues, chest rigs, balaclavas or face scarves, and green headbands.
- Four roles:
  - pistol fighters;
  - AK-47 riflemen;
  - RPG gunners, who seek high ground;
  - suicide bombers, with a taped explosive vest, a blinking detonator light and a warning beep.
- Pathfinding across floors and stairs, line-of-sight reactions, burst fire and grenade throws.
- Hit boxes follow the skeleton, so headshots register exactly.
- Hit reactions and death animations; bodies stay for two minutes.
- Only armed combatants appear; there are no civilians.

### Weapons and combat
- An M4 carbine, a semi-automatic pistol, a combat knife, fragmentation grenades and smoke grenades.
- Aim down sights, sprint, toggle crouch, jump, and hold-to-lean that is stopped by walls.
- Explosive fuel drums: two hits make a drum burn, and 1.6 seconds later it explodes with a 9 m blast that damages everyone nearby and can set off other drums.
- Destructible crate cover with physics-driven fragments.
- Smoke clouds that block enemy sight lines.
- Muzzle flash, tracers, ejected casings, recoil and weapon sway, surface-specific impacts, bullet holes, blood and blast scorches.

### Interface
- A heading-up minimap: forward is always up, and the map turns with you. Enemies, health packs and ammunition crates are marked, off-screen supplies are pinned to the rim, and a north marker shows orientation.
- A directional damage indicator and a warning marker that points to nearby live enemy grenades.
- Main menu, mission briefing, loading screen with progress, pause menu, settings (mouse sensitivity, field of view, master, effects and music volume, and graphics quality), help and credits.

### Presentation and audio
- Photo-scanned physically based materials.
- An HDRI sky with image-based lighting for each map, with a sun matched to it.
- Percentage-closer filtered shadows, fog, ACES tone mapping with a per-map colour grade, bloom and film grain.
- Recorded firearm sounds with near and far variants, explosions, voices and footsteps on different surfaces.
- Spatial audio, separate music and ambience, and combat and menu music.

### Performance
- Static city geometry is merged into a few dozen draw calls, with a single static physics body.
- Every shader a wave needs is compiled behind the loading screen, and explosion and fire lights are reused, so new effects or enemies don't cause hitches in a fight.
- Fighters clone only the gear and animation clips their role uses.
- Three graphics quality levels (Low, Medium and High).

### Deployment
- `npm run build` produces a static `dist/` folder that runs from any web server or sub-folder, with no server-side software and no external requests.
- Development test hooks are stripped from the production build.

### Testing
- Vitest suites for:
  - game rules (scoring, ammunition, damage, timers, respawns and supplies);
  - map layouts (spawn clearance, reachability, upper floors and walk-through doorways).
- Playwright browser tests in Chromium and Firefox, covering:
  - menus, input, real mouse buttons and pointer lock;
  - weapons and cover controls;
  - all three waves;
  - the production build.
