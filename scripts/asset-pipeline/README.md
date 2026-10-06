# Asset pipeline

The game ships only the processed files in `public/assets/`. These scripts document how they were produced from the freely licensed sources listed in `ASSET-CREDITS.md`. They are not needed to build or run the game.

Run the scripts from a scratch work directory (not the project root). The source downloads are large (~650 MB), so do not keep them inside the repository.

Tools: Blender 4.x (with `numpy` on Blender's Python path), Python 3 with `numpy` and `Pillow`, ImageMagick, sox, ffmpeg and Node.js with Playwright.

| Step | Script | Output |
| --- | --- | --- |
| Download Quaternius packs from itch.io (Universal Base Characters, Modular Character Outfits – Fantasy, Universal Animation Library 1 and 2, 50+ LowPoly Guns) | `fetch-itch.sh <page-url> <file-substring> <out.zip>` | `dl/*.zip` (unzip into `dl/ubc`, `dl/outfits`, `dl/ual`, `dl/ual2`, `dl/guns`) |
| Download Poly Haven textures (1K: diffuse, OpenGL normal, AO/rough/metal) | `fetch-polyhaven-textures.py <id,id,...>` | `ph/tex/<id>/` |
| Download Poly Haven props (1K glTF) | `fetch-polyhaven-models.py <id,id,...>` | `ph/models/<id>/` |
| Download Poly Pizza models (wrecked cars, RPG launcher, grenade) | direct GLB links in `ASSET-CREDITS.md` | `pp/<id>.glb` |
| Recolour the Ranger outfit into camo, olive, black, desert and IDF variants | `recolor-outfits.py` | `char/outfit_*.jpg` |
| Build the rigged enemy fighter: base head, outfit, balaclava, face scarf, green headband, chest rig, bomber vest, AK, pistol, RPG and baked weapon-holding animations | `blender -b -P build-fighter.py -- --export` | `char/fighter.glb` → `public/assets/models/` |
| Build first-person arms and weapons (eye-space, front sight on the view axis) | `blender -b -P build-viewmodel.py` | `char/viewmodel.glb` |
| Optimise props (decimate, 512–1024 px textures) | `blender -b -P build-prop.py -- name=<id> src=<gltf> tex=512 maxtris=3000` | `props_out/*.glb` → `public/assets/models/props/` |
| Charred and rusted car wrecks | `blender -b -P build-wreck.py -- name=<n> src=<glb> tex=burnt\|rust` | `props_out/wreck_*.glb` |
| Sky panoramas from HDRIs | `grade-skies.py` (uses `hdr-to-jpg.py`) | `public/assets/env/sky_*.jpg` |
| Prefiltered image-based lighting | `node bake-env.mjs` (headless Chromium + Babylon.js) | `public/assets/env/env_*.env` |
| Sound effects, ambience and music (trimmed, normalised, Ogg Vorbis) | `build-audio.sh` | `public/assets/audio/*.ogg` |

Textures were copied to `public/assets/textures/<id>/{albedo,normal,arm}.jpg` with ImageMagick (`-resize 1024` for albedo and normal maps, `-resize 512` for AO/rough/metal). Particle sprites come from Kenney's Particle Pack, Smoke Particles and Splat Pack. Bullet-hole, scorch and dust sprites were generated procedurally.
