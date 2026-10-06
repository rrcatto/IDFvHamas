# BUILD THE COMPLETE GAME: IDF v Hamas

You are an autonomous senior game developer. Build a complete, playable, tested desktop-browser first-person shooter from scratch.

The user is **not participating in implementation**. You have filesystem and Bash access. You must create the project, install dependencies, create all source files, acquire or construct all required assets, run the project, test it, debug it, build it and leave behind a finished working game.

Do **not** ask the user to:
- create files;
- edit source code;
- operate an editor;
- configure Babylon.js;
- download assets;
- install npm packages individually;
- troubleshoot errors;
- create maps;
- configure scenes;
- test ordinary gameplay that you can test yourself;
- make routine implementation decisions.

When something is unspecified, make the most sensible game-development decision yourself and continue.

Do not stop at a prototype or scaffolding. Deliver the complete game described below.

---

# 1. GAME IDENTITY

**Project name:** `idf-v-hamas`

**Displayed game title:**

IDF v Hamas

**Subtitle:**

Kill the waves of terrorists, save Israel!

This is a fictional FPS combat game depicting fighting between an IDF soldier controlled by the player and armed Hamas combatants.

There are **no civilians** in the game. Every human NPC appearing in the combat areas is an armed enemy combatant.

Do not include real-world calls to action, links, propaganda material, recruitment material or instructions for real violence. This is purely fictional entertainment.

---

# 2. TECHNICAL STACK

Build this as a conventional browser application consisting entirely of source code and web assets.

Use:

- Babylon.js 9.x ES modules, preferably `@babylonjs/core` 9.28.x or the latest compatible stable 9.x version available at installation time.
- TypeScript.
- Vite.
- npm.
- `@babylonjs/havok` for 3D physics where appropriate.
- Babylon GUI and normal HTML/CSS where appropriate for HUD/menu interfaces.
- glTF/GLB for externally sourced 3D models.
- Web Audio/Babylon audio facilities for sound.
- Strict TypeScript.
- WSL Ubuntu/Bash development environment.
- Desktop browsers only.
- Keyboard and mouse controls only.

Do not use React, Vue, Angular or another application framework unless there is a compelling technical reason.

Do not use a backend.

Do not use a database.

Do not use localStorage or another persistence mechanism.

Do not use Git or initialise a Git repository.

The production build must be a self-contained static website deployable by copying `dist/` to an ordinary Nginx web root.

All required runtime resources must exist locally inside the finished project. The production game must not depend upon a CDN or an Internet connection.

Set Vite up so the built application can be served from an ordinary directory or website path without fragile absolute asset URLs.

---

# 3. AUTONOMOUS BUILD REQUIREMENT

You own the entire implementation.

Create the project and all files yourself.

Install required npm dependencies yourself.

If freely licensed assets can materially improve the game, download and incorporate them yourself.

If a desired external asset cannot be obtained reliably or legally, construct an acceptable procedural or primitive-based substitute and continue.

Do not suspend implementation waiting for an ideal model, texture, animation or sound.

The hierarchy is:

1. working gameplay;
2. correct mechanics;
3. stable performance;
4. convincing FPS presentation;
5. graphical polish.

A visually simpler working feature is preferable to an elaborate broken feature.

---

# 4. VISUAL STYLE AND ENVIRONMENT

The visual target is a realistic modern military FPS inspired by games such as Insurgency: Sandstorm, while remaining achievable as a compact browser game.

The environment should evoke a **war-torn Middle Eastern city**, visually influenced by Fallujah-style urban combat:

- damaged concrete buildings;
- narrow streets;
- wider roads;
- alleys;
- courtyards;
- rubble;
- collapsed walls;
- damaged shops;
- abandoned vehicles;
- barricades;
- sandbags;
- concrete barriers;
- crates;
- debris;
- exposed reinforcing steel where practical;
- partially destroyed interiors;
- dusty atmosphere;
- scorch marks;
- damaged façades;
- roofs/balconies;
- staircases;
- occasional bridges or elevated crossings.

Do not attempt to reproduce an identifiable real-world neighbourhood. Construct fictional battle spaces inspired by this general environment.

Lighting should suggest a hot, dusty urban combat area.

The game should look coherent rather than like unrelated downloaded assets thrown together.

Use PBR materials where practical.

Use reasonable shadows, ambient lighting, fog/dust and environmental detail without sacrificing the 60 FPS target.

---

# 5. THREE DISTINCT MAPS

There are exactly three waves and exactly three maps.

Each wave takes place on a different map.

Each map must be medium-sized and support both street combat and fighting inside buildings.

Create maps approximately along these lines, but change names/layout details if that produces a better result.

## Map 1 — Market Quarter

Dense urban streets and alleys.

Include:
- damaged shops;
- narrow lanes;
- interiors;
- courtyards;
- several two-storey buildings;
- roof/balcony firing positions;
- street barricades;
- rubble piles;
- plenty of cover.

This is primarily a pistol/grenade battle.

## Map 2 — Residential District

Slightly more open.

Include:
- apartment-style buildings;
- interconnected interiors;
- larger road;
- damaged vehicles;
- courtyards;
- alleys;
- several two-storey structures;
- open crossing areas;
- substantial cover.

This introduces assault rifles.

## Map 3 — Ruined Crossing

The most dangerous map.

Include:
- damaged overpass, bridge or elevated roadway;
- larger open road;
- rubble;
- destroyed structures;
- interiors;
- narrow flanking routes;
- open firing lanes;
- two-storey buildings;
- defensive positions;
- destructible objects.

This map must support rockets and suicide bombers while still giving the player ways to move and find cover.

There is no water.

---

# 6. PLAYER

Standard modern FPS presentation.

Use:
- first-person camera;
- visible weapon;
- visible hands/arms if suitable assets are available;
- natural FPS weapon sway;
- subtle movement bob;
- recoil;
- aim-down-sights transition.

Movement must feel relatively realistic rather than like an arena shooter.

Player health:

**1000 HP**

Controls:

- `W` forward
- `S` backward
- `A` strafe left
- `D` strafe right
- mouse = look
- left mouse = fire/attack
- right mouse = aim down sights
- `Shift` = sprint
- `Ctrl` = crouch
- `Space` = jump
- `R` = reload
- `1` = assault rifle
- `2` = sidearm
- `3` = knife
- `4` = fragmentation grenade
- `5` = smoke grenade
- `Esc` = pause
- `F` or `E` = interact/use ammo or health supply as appropriate

Choose one consistent interaction key and show it in the controls screen.

Pointer lock is required during gameplay.

Fullscreen must be supported.

Because browsers require user gestures for fullscreen/pointer lock, obtain them naturally when the player clicks Play/Resume.

---

# 7. PLAYER WEAPONS

The player always spawns with the same loadout.

## Assault rifle

Modern military assault rifle.

Properties:
- hitscan;
- 30-round magazine;
- five magazines total when fully supplied;
- therefore 150 rifle rounds maximum carried;
- automatic fire;
- visible recoil;
- modest spread;
- tighter spread when aiming;
- appropriate muzzle flash;
- shell/ejection effect if inexpensive;
- firing sound;
- reload sound;
- empty-weapon feedback.

A partially used magazine should preferably retain its ammunition when performing a tactical reload rather than magically combining rounds.

Do not make magazine accounting so complicated that it threatens reliability.

## Sidearm

Semi-automatic military pistol.

Properties:
- hitscan;
- 15-round magazine;
- three magazines total;
- therefore 45 rounds maximum carried;
- recoil;
- ADS;
- firing/reload sounds.

## Knife

Close-range melee attack.

Knife attacks should kill an ordinary enemy when a proper melee hit connects at close range.

Track knife kills separately.

## Fragmentation grenades

Player carries:

**3 fragmentation grenades**

Implement:
- visible thrown projectile;
- fuse;
- explosion;
- radial damage;
- distance falloff;
- sound;
- flash;
- smoke/debris particles;
- impulse on nearby physics objects/enemies.

## Smoke grenade

Player carries:

**1 smoke grenade**

Implement a convincing temporary smoke cloud which substantially obscures visibility.

It must affect the player's ability to see.

Enemy AI should have substantially reduced practical detection/accuracy through dense smoke rather than seeing perfectly through it.

---

# 8. AMMUNITION

Ammunition is limited.

Every new player life begins with the full standard loadout.

Maps contain either one or two ammunition boxes.

When two are used, put them well apart so one location cannot dominate the map.

An unused ammunition box interaction restores:
- rifle ammunition to maximum;
- pistol ammunition to maximum;
- fragmentation grenades to 3;
- smoke grenades to 1.

Each ammo box should provide **one complete resupply per wave** rather than acting as an unlimited camping source.

Reset supplies appropriately when entering a new map/wave.

---

# 9. HEALTH PACKS

Each map/wave contains exactly:

**5 health packs**

Each can be used once during that wave.

A health pack restores the player to:

**1000 HP**

Do not allow health above 1000.

Use sensible placement so obtaining health sometimes requires exposing the player to risk.

---

# 10. PLAYER DEATH AND RESPAWN

The player has unlimited lives.

On death:
- show an appropriate death state;
- disable combat input;
- show a visible 15-second respawn countdown;
- then respawn at an appropriate player spawn point.

Respawn delay:

**15 seconds**

There is no score penalty for dying.

After respawning, the player receives:

**5 seconds of spawn protection**

Indicate spawn protection clearly but unobtrusively.

The player respawns with:
- 1000 HP;
- standard full weapon loadout.

Do not end a wave because the player died.

The five-minute wave timer should continue running while the player is dead.

---

# 11. ENEMIES

Enemies are armed Hamas combatants.

Use generic fictional combatant models/uniforms rather than attempting photorealistic reproductions of real individuals.

Enemies should be visually distinguishable from the player side.

Enemy AI can remain deliberately understandable and robust.

Core AI behaviour:

- spawn;
- locate player;
- navigate toward useful combat positions;
- attack player when appropriate;
- pursue when required;
- avoid obvious obstacles;
- use buildings and streets;
- move rather than remain stationary forever;
- reacquire the player if line of sight is lost.

Use navigation/pathfinding appropriate to Babylon.js.

Enemies should not require sophisticated tactical squad AI.

They do **not** need:
- complex military formations;
- advanced coordinated flanking;
- advanced cover-selection AI;
- realistic communication networks.

Reliability is more important.

---

# 12. ENEMY HIT BEHAVIOUR

Ordinary enemy firearm lethality:

- headshot = immediate kill;
- body = approximately three valid firearm hits to kill.

A headshot is worth more points.

Implement proper hit zones sufficiently robustly to distinguish head from body.

When hit, enemies should:
- react visibly;
- jerk/stagger/knock back appropriately;
- sometimes fall or stumble if feasible;
- make an injury vocalisation.

On death:
- play/use an appropriate death reaction;
- enemy falls;
- body remains in the environment for approximately 2 minutes;
- corpse is eventually removed cleanly to control performance.

Do not immediately vanish dead enemies.

Use physics/ragdoll only if reliable and performant. A good death animation plus physical settling is acceptable.

---

# 13. ENEMY AUDIO

Enemies should produce occasional:
- pain sounds;
- death screams/shouts;
- combat shouts;
- weapon sounds.

Use royalty-free/licensable generic combat vocalisations where available.

Do not use copyrighted dialogue ripped from commercial games.

Do not include ethnic slurs or real-world propaganda chants.

Avoid repetitive spam.

Use several variants if possible.

---

# 14. ENEMY SPAWN SYSTEM

Enemy spawn points are predefined intelligently around each map.

The player must not be able to stand beside one spawn point and repeatedly kill appearing enemies.

When choosing a spawn:
- prefer points distant from the player;
- reject points too close to the player;
- strongly prefer points outside the player's current direct line of sight;
- randomise between valid spawn locations.

Enemy population:

- Wave 1: target 5 simultaneous enemies.
- Wave 2: target 6 simultaneous enemies.
- Wave 3: target 7 simultaneous enemies.

After an enemy dies, schedule a replacement approximately:

**30 seconds later**

Continue replacing enemies until the five-minute wave timer expires.

Do not spawn replacement enemies once the wave has ended.

---

# 15. WAVE 1

Duration:

**5:00 exactly**

Map:

**Map 1**

Enemy weapons:
- pistols;
- fragmentation grenades.

Enemies do not have assault rifles in Wave 1.

The wave ends immediately when the clock reaches zero regardless of surviving enemies.

Freeze/end remaining combat cleanly and show the Wave 1 statistics screen.

The user explicitly chooses when to begin Wave 2.

---

# 16. WAVE 2

Duration:

**5:00 exactly**

Map:

**Map 2**

Enemy equipment:
- AK-style assault rifles;
- sidearms where useful;
- fragmentation grenades.

Wave 2 should feel substantially more dangerous than Wave 1 without simply making enemies absurdly accurate.

After five minutes, end combat and show the Wave 2 statistics screen.

The user explicitly chooses when to begin Wave 3.

---

# 17. WAVE 3

Duration:

**5:00 exactly**

Map:

**Map 3**

Enemy threat types include:
- AK-style assault rifles;
- fragmentation grenades;
- rocket launchers;
- suicide bombers.

Rocket launchers must use visible projectiles rather than hitscan.

Rockets:
- travel through the world visibly;
- collide properly;
- explode on impact;
- have blast radius and damage falloff;
- damage destructible objects;
- have suitable sound and effects.

Do not allow every enemy to use rockets. They should be a dangerous specialist threat.

---

# 18. SUICIDE BOMBERS

Wave 3 contains occasional suicide-bomber enemies.

They must be visually or behaviourally recognisable enough that an observant player can identify the threat.

Behaviour:
- attempt to approach the player rapidly;
- do not use ordinary firearms while making the attack;
- detonate when close enough;
- can be shot and killed before reaching the player;
- killing one before detonation counts as an ordinary kill;
- explosion can damage nearby enemies and destructible objects.

Give the player meaningful time to react.

Do not spawn them directly beside the player.

Their explosion must not be unavoidable merely because the enemy spawned.

---

# 19. DIFFICULTY

Main menu provides:

- Easy
- Normal
- Hard

Do not simply multiply enemy HP.

Ordinary enemies retain the same fundamental headshot/body-shot rules.

Difficulty should affect primarily:
- enemy reaction delay;
- firearm accuracy;
- firing cadence;
- aggression;
- grenade frequency;
- tracking ability;
- willingness to close distance;
- possibly enemy damage within sensible bounds.

Suggested philosophy:

**Easy**
- noticeably slower reaction;
- poorer aim;
- lower aggression;
- less grenade use.

**Normal**
- intended standard experience.

**Hard**
- faster reaction;
- better but not perfect aim;
- greater aggression;
- somewhat more grenade pressure.

Never create obvious aimbot behaviour.

---

# 20. DAMAGE BALANCE

Player has 1000 HP, so tune enemy damage to allow a short firefight rather than killing the player with one ordinary bullet.

As an initial balance target on Normal:
- pistol hit: approximately 80–100 HP;
- rifle hit: approximately 110–140 HP;
- grenade damage: strong radial falloff;
- rocket: lethal or nearly lethal near blast centre;
- suicide explosion: lethal or nearly lethal at close range.

Playtest and adjust.

The purpose is tension, not instant unavoidable death.

---

# 21. SCORING

Normal kill:

**100 points**

Headshot kill:

**150 points total**

Do not add 100 + 150. A headshot kill is worth 150.

Knife kills count as normal kills unless the implementation has a compelling reason for a small bonus. Prefer 100 for consistency.

No death penalty.

Do not create persistent high scores.

---

# 22. STATISTICS

Track overall statistics and per-wave statistics.

At minimum track:

- kills;
- deaths;
- score;
- shots fired;
- shots hit;
- accuracy percentage;
- headshot kills;
- rifle kills;
- pistol kills;
- knife kills;
- fragmentation-grenade kills;
- environmental explosive kills;
- suicide bombers killed before detonation;
- times player was killed by explosions;
- current kill streak;
- best kill streak;
- enemies killed per wave.

Do not count grenades as firearm shots when calculating firearm accuracy.

Define accuracy consistently:

`firearm hits / firearm shots fired × 100`

A shotgun does not exist, so pellet ambiguity is irrelevant.

---

# 23. BETWEEN-WAVE SCREEN

At the end of every five-minute wave:

- stop active combat;
- present that wave's statistics clearly;
- show elapsed wave as complete;
- identify the next wave/map;
- allow the player to review stats for as long as desired.

The next wave does **not** start automatically.

Display a clear instruction such as:

`Press Enter to begin Wave 2`

or an equivalent button/key.

The five-minute timer for the next wave starts only after the player intentionally begins it.

---

# 24. FINAL GAME-OVER SCREEN

After Wave 3, show a complete results screen.

Include:
- total score;
- total kills;
- total deaths;
- rifle kills;
- pistol kills;
- knife kills;
- grenade/explosive kills;
- headshots;
- shots fired;
- shots hit;
- overall accuracy;
- best kill streak;
- statistics for Wave 1;
- statistics for Wave 2;
- statistics for Wave 3.

Do not show rankings.

Do not show high scores.

Include:

**Play Again**

and

**Main Menu**

Play Again starts a completely new session with zeroed statistics.

---

# 25. HUD

During combat, create a clean military-FPS-style HUD.

Display:
- health;
- current weapon;
- ammunition in current magazine;
- reserve magazines/ammunition;
- fragmentation grenades remaining;
- smoke grenades remaining;
- current wave;
- countdown timer;
- kills;
- score;
- enemies currently alive.

Use a simple crosshair.

Do not display the crosshair prominently while fully aimed down sights if the weapon sight itself provides the aiming point.

---

# 26. MINI-MAP

Place a mini-map in the:

**top-left corner**

It must rotate or otherwise clearly communicate player orientation.

Show:
- player;
- map/nearby structural context;
- enemy locations;
- health pack locations where useful;
- ammunition boxes where useful.

Do not show enemy spawn points.

Make it useful without occupying excessive screen space.

---

# 27. DAMAGE INDICATOR

When the player is hit, show directional damage feedback indicating approximately where the shot/explosion came from.

Use:
- translucent red directional arcs/wedges or equivalent;
- brief screen damage feedback.

Avoid obscuring the player's view excessively.

---

# 28. DESTRUCTIBLE ENVIRONMENT

Some cover must be destructible.

Do not attempt fully destructible buildings.

Suitable destructible objects:
- wooden crates;
- lightweight barricades;
- selected walls/panels;
- props;
- debris barriers.

Destruction must:
- respond to sufficient weapon/explosive damage;
- create convincing visual breakage;
- affect collision appropriately;
- clean up unnecessary fragments eventually.

Use a limited number of destructible objects so performance remains good.

---

# 29. EXPLOSIVE OIL BARRELS

Include oil/fuel barrels in appropriate locations.

When sufficiently damaged:
1. barrel begins burning or visibly becomes unstable;
2. brief warning interval;
3. barrel explodes;
4. blast damages player/enemies/nearby destructibles;
5. explosion produces fire/smoke/light/sound.

Allow useful environmental kills.

Track them.

Chain reactions between nearby explosive barrels are acceptable.

---

# 30. AUDIO

Acquire and bundle royalty-free or suitably licensed sound effects where possible.

Need sound for:
- rifle shots;
- pistol shots;
- dry-fire/empty weapon;
- reloads;
- grenades;
- rockets;
- explosions;
- barrel fires/explosions;
- bullet impacts;
- footsteps;
- player injury/death;
- enemy injuries;
- enemy deaths;
- enemy battle vocalisations;
- knife attack/hit;
- ammo pickup/resupply;
- health use;
- interface interaction.

Use spatial 3D audio where appropriate.

Everything must be stored locally with the finished game.

---

# 31. MUSIC

Use a royalty-free or properly licensed combat backing track.

It should:
- create tension;
- not overwhelm gunfire;
- loop cleanly;
- have separate volume control;
- continue appropriately through combat;
- become quieter or change presentation on menus/results if appropriate.

Do not use copyrighted commercial-game music.

Bundle it locally.

---

# 32. ASSET LICENSING

You may download free assets from legitimate sources including appropriate public-domain, CC0, attribution-compatible or similarly usable libraries.

Prefer permissive assets.

Maintain:

`ASSET-CREDITS.md`

For every externally sourced asset record:
- asset name;
- creator if known;
- source URL;
- licence;
- where it is used.

Do not use assets where licensing is unclear.

Do not hotlink assets.

The final game must work offline.

If attribution is legally required, include it appropriately in the game Credits screen as well.

---

# 33. ENEMY AND CHARACTER ANIMATION

Where suitable assets permit, enemies should have:
- idle;
- walk/run;
- aim;
- fire;
- throw;
- hit reaction;
- death.

Do not delay completion indefinitely searching for perfect animated models.

If necessary, use a simpler generic animated humanoid model that integrates reliably.

Animation quality is secondary to gameplay correctness.

---

# 34. MAIN MENU

Main menu options:

- Play
- How to Play
- Settings
- Fullscreen
- Credits

Do not include High Scores.

When Play is selected, allow difficulty selection if it was not already chosen.

Then begin Wave 1.

---

# 35. HOW TO PLAY

No tutorial level.

Provide a concise key-mapping/help screen before playing and from the menu.

Explain:
- movement;
- sprint;
- crouch;
- jump;
- fire;
- ADS;
- reload;
- weapon-selection keys;
- grenade;
- smoke;
- interaction;
- pause.

Also explain in a few lines:
- three waves;
- each lasts five minutes;
- deaths cause a 15-second respawn;
- kills earn points;
- headshots earn 150;
- ammo and health supplies exist in each map.

---

# 36. PAUSE MENU

`Esc` pauses the game.

Pause menu:

- Resume
- Restart Game
- Settings
- Quit to Main Menu

Pause:
- timer;
- AI;
- relevant physics/gameplay;
- combat actions.

Do not let enemies kill the player while paused.

---

# 37. SETTINGS

Provide runtime settings for:

- master volume;
- effects volume;
- music volume;
- mouse sensitivity;
- field of view;
- graphics quality;
- fullscreen.

Graphics quality may reasonably control:
- render scaling;
- shadow quality;
- particle density;
- selected post-processing.

Settings do not need to persist after closing/reloading the page.

---

# 38. GRAPHICS AND EFFECTS

Aim for convincing realistic presentation within browser constraints.

Use effects such as:
- muzzle flashes;
- impact sparks;
- concrete dust;
- bullet decals;
- modest blood effects;
- grenade smoke;
- explosion smoke/fire;
- barrel fire;
- environmental dust.

Blood should be visible but restrained.

Do not make gore the focus.

Enemies fall and may show blood effects, but do not implement dismemberment.

---

# 39. SMOKE

Smoke grenades are tactically important.

Smoke should:
- grow after detonation;
- become dense enough to obscure sight;
- persist for a useful period;
- gradually dissipate;
- not destroy performance.

Enemy targeting through smoke must be reduced substantially.

Do not implement purely cosmetic smoke that enemies can see through perfectly.

---

# 40. PERFORMANCE

Target:

**60 FPS**

on a normal modern desktop/laptop browser at sensible settings.

Optimise where needed using:
- sensible mesh counts;
- instances/thin instances where beneficial;
- limited dynamic shadows;
- pooled effects/projectiles where appropriate;
- cleanup of dead enemies and temporary objects;
- bounded particles;
- efficient update loops.

Maximum enemy count is low, so spend some visual budget on atmosphere and map detail.

Avoid premature overengineering.

---

# 41. BROWSER SUPPORT

Primary target:

- current Chromium-based desktop browsers;
- current Firefox desktop.

Keyboard and mouse only.

Do not implement:
- mobile controls;
- touch controls;
- console controller support.

The canvas must resize correctly with the browser window.

Support fullscreen desktop gameplay.

---

# 42. PROJECT ARCHITECTURE

Use a clean modular TypeScript architecture.

Do not put the entire game in one enormous file.

Organise responsibilities approximately into areas such as:

- application/bootstrap;
- game state;
- map loading;
- player;
- weapons;
- projectiles;
- enemies;
- enemy AI;
- spawning;
- waves;
- physics;
- damage;
- destructibles;
- pickups;
- statistics;
- audio;
- HUD;
- menus;
- minimap;
- asset management;
- configuration.

The exact file structure is your responsibility.

Avoid needless abstraction and enterprise-style architecture.

This is a small game.

---

# 43. CONFIGURATION

Put important gameplay tuning values in one or a small number of clearly documented configuration modules rather than scattering unexplained magic numbers everywhere.

Examples:
- health;
- weapon damage;
- magazine capacity;
- reload times;
- enemy accuracy;
- enemy reaction times;
- spawn delay;
- wave duration;
- explosion radius;
- difficulty multipliers.

This should make later balancing straightforward.

---

# 44. GAME STATE

Implement explicit game states so transitions cannot become confused.

At minimum support states equivalent to:

- MainMenu
- WaveStarting
- Playing
- PlayerDead
- WaveComplete
- Paused
- GameComplete

Ensure timers do not continue accidentally through states where they should be stopped.

The wave timer **does** continue while the player is dead.

The wave timer **does not** continue while the game is manually paused.

---

# 45. COLLISION AND PHYSICS

Use robust collisions.

Player must not:
- walk through walls;
- fall through floors;
- climb impossible vertical surfaces;
- become permanently trapped easily.

Enemies must not:
- routinely walk through walls;
- fall through floors;
- spawn inside geometry.

Grenades, rockets, barrels and destructible objects should interact plausibly with the environment.

Use Havok only where it improves the implementation. Do not make every static map object a costly dynamic rigid body.

---

# 46. NAVIGATION

Enemy navigation must work both:
- outdoors;
- inside buildings.

Enemies should be capable of:
- entering doors;
- traversing corridors;
- using stairs where maps require them;
- navigating around major obstacles.

Test navigation rather than assuming it works.

Avoid map geometry that the selected navigation implementation cannot traverse reliably.

---

# 47. SPAWN SAFETY

Player and enemy spawn systems must actively avoid obvious spawn-killing.

For enemies:
- choose among multiple locations;
- avoid close player proximity;
- avoid direct player view where possible.

For player respawns:
- choose from multiple valid player spawn positions;
- prefer locations away from nearby enemies;
- provide five seconds of spawn protection regardless.

---

# 48. INTERACTION AND POLISH

Provide appropriate feedback for:
- taking damage;
- damaging an enemy;
- headshot;
- kill;
- attempted firing while empty;
- reload;
- ammo resupply;
- health use;
- wave ending;
- respawn countdown.

Do not overload the screen with arcade-style floating numbers.

This should feel closer to a military FPS than an arcade shooter.

---

# 49. TESTING REQUIREMENT

You must test your own work.

Do not declare completion merely because TypeScript compiles.

At minimum:

1. run dependency installation successfully;
2. run TypeScript/static checking;
3. run any unit/system tests;
4. run the Vite development build;
5. load the game in a real browser or headless browser;
6. check browser console for runtime errors;
7. verify the main menu loads;
8. start Wave 1;
9. verify player movement/input;
10. verify firing;
11. verify enemy spawn and AI;
12. verify enemy damage/death;
13. verify player damage/death/respawn;
14. verify wave timer;
15. verify transition between maps;
16. verify Wave 2;
17. verify Wave 3;
18. verify statistics;
19. verify pause/resume;
20. verify game-over/restart;
21. run a production build;
22. serve the production build;
23. smoke-test the production build.

If browser automation such as Playwright is available or useful, use it.

Install testing tooling yourself if appropriate.

For gameplay mechanics that cannot realistically be exercised fully by a headless agent, construct deterministic development/testing hooks or automated tests for the underlying state logic, then remove or disable any visible debug controls from the production experience.

---

# 50. AUTOMATED TESTS

Create meaningful automated tests for pure game logic where practical, particularly:

- scoring;
- weapon ammo/reloading;
- damage/headshot calculations;
- wave timing;
- statistics;
- difficulty configuration;
- respawn logic;
- enemy replacement scheduling;
- supply use limits;
- state transitions.

Do not attempt to unit-test every Babylon rendering call.

Test the logic that would otherwise be easy to break.

---

# 51. DEVELOPMENT DEBUGGING

During development you may create:
- debug overlays;
- AI indicators;
- collision displays;
- spawn markers;
- navigation visualisation;
- invulnerability toggles;
- accelerated wave timers.

These should be removed, disabled or inaccessible in the normal production experience.

Do not leave ugly debugging UI visible.

---

# 52. RESILIENCE

Do not fail the entire project because one secondary feature proves difficult.

If an advanced effect is unreliable:
- simplify it;
- preserve the intended gameplay;
- continue.

Examples:

If ragdolls are unreliable:
- use quality death animations.

If fully breakable walls are unreliable:
- use specifically designed breakable cover props.

If sophisticated dynamic smoke/AI occlusion is too costly:
- use smoke volumes and an explicit AI visibility penalty.

If an ideal realistic character model cannot legally be obtained:
- use a simpler licensed combatant model.

Finish the game.

---

# 53. PRODUCTION BUILD

The final project must successfully produce:

`dist/`

through a normal command such as:

`npm run build`

The resulting directory must contain everything required to run the game as a static website.

No Internet connection may be required at runtime.

Do not require:
- PHP;
- Node server in production;
- database;
- API;
- login;
- cloud service.

Nginx should be able to serve the files directly.

---

# 54. README

Create a useful `README.md` explaining:

- what the game is;
- technical stack;
- prerequisites;
- how to install dependencies;
- how to run development mode;
- how to run tests;
- how to produce a production build;
- how to preview the build;
- controls;
- project structure at a useful high level;
- where major gameplay configuration values live;
- static deployment instructions.

Keep it practical.

---

# 55. DEFINITION OF DONE

The task is not complete until all of the following are true:

- project exists and is structured sensibly;
- dependencies install successfully;
- game starts successfully;
- main menu works;
- settings work;
- fullscreen works;
- pointer lock works;
- player can move naturally;
- player can sprint/crouch/jump;
- rifle works;
- pistol works;
- knife works;
- frag grenades work;
- smoke grenades work;
- ammunition limits work;
- reloading works;
- ammo boxes work;
- health packs work;
- enemies navigate;
- enemies shoot/attack;
- enemy grenades work;
- headshots work;
- body-shot lethality works;
- player takes damage;
- player dies;
- 15-second respawn works;
- five-second spawn protection works;
- destructible cover exists;
- exploding barrels work;
- Wave 1 works;
- Wave 2 works;
- Wave 3 works;
- rockets work;
- suicide bombers work;
- each wave lasts five minutes;
- enemies respawn on the required schedule;
- per-wave statistics work;
- overall statistics work;
- minimap works;
- directional damage indicator works;
- pause/resume works;
- final results work;
- Play Again works;
- sound works;
- backing music works;
- assets are locally bundled;
- asset licences are documented;
- TypeScript checks pass;
- automated tests pass;
- browser smoke test passes;
- no significant browser-console errors remain;
- production build succeeds;
- production build has been smoke-tested;
- README exists;
- `ASSET-CREDITS.md` exists;
- game works offline after installation/build;
- no backend exists;
- no Git repository was created.

---

# 56. FINAL INSTRUCTION

Proceed immediately.

Do not respond with an implementation plan and stop.

Do not ask the user to choose libraries, assets, file structures or minor gameplay values.

Inspect the available environment, create the project and **build the game**.

Make reasonable decisions where necessary.

Run it.

Test it.

Fix what fails.

Repeat until the production build is genuinely playable.

Only then give the user a concise completion report containing:

- what was built;
- project location;
- how to launch development mode;
- how to build production;
- where `dist/` is;
- tests/checks performed and their results;
- any genuinely material limitations that remain.

Do not call unfinished work complete.
