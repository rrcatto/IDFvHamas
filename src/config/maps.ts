/**
 * Per-map atmosphere. Sun direction is given as elevation/azimuth in degrees; azimuth 0 is +Z
 * (north on the minimap) and 90 is +X. Sky panoramas and image-based lighting come from
 * Poly Haven CC0 HDRIs (see ASSET-CREDITS.md).
 */
export type Atmosphere = {
  name: string;
  brief: string;
  sky: string;
  env: string;
  skyRotation: number;
  sun: { elevation: number; azimuth: number; color: string; intensity: number };
  hemi: { intensity: number; sky: string; ground: string };
  envIntensity: number;
  fog: { color: string; density: number };
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  shadowDarkness: number;
  ambient: 'dust' | 'haze' | 'ash';
  smokeColumns: [number, number, number][];
};

export const MAPS: Atmosphere[] = [
  {
    name: 'Market Quarter',
    brief: 'Dense stone lanes around a shell-damaged covered market. Close quarters: pistols and grenades.',
    sky: 'sky_market', env: 'env_market', skyRotation: 0,
    sun: { elevation: 53, azimuth: 53.7, color: '#fff0d8', intensity: 3.4 },
    hemi: { intensity: 0.75, sky: '#d7dde6', ground: '#9a8466' },
    envIntensity: 1.25,
    fog: { color: '#c8c0ad', density: 0.0072 },
    exposure: 1.18, contrast: 1.12, saturation: -6, warmth: 6, shadowDarkness: 0.4,
    ambient: 'dust',
    smokeColumns: [[-48, 30, 1], [52, -20, 0.8]],
  },
  {
    name: 'Residential District',
    brief: 'Apartment blocks either side of a wrecked boulevard under a low evening sun. Rifles at medium range.',
    sky: 'sky_residential', env: 'env_residential', skyRotation: 0,
    sun: { elevation: 19, azimuth: 40.2, color: '#ffbf7a', intensity: 3.3 },
    hemi: { intensity: 0.7, sky: '#c7c9d6', ground: '#8a6a4c' },
    envIntensity: 1.2,
    fog: { color: '#c9a07a', density: 0.009 },
    exposure: 1.14, contrast: 1.12, saturation: -4, warmth: 16, shadowDarkness: 0.42,
    ambient: 'haze',
    smokeColumns: [[-55, -35, 1.1], [40, 55, 0.9], [60, 10, 0.7]],
  },
  {
    name: 'Ruined Crossing',
    brief: 'A collapsed highway interchange under smoke and overcast. Rockets, suicide bombers, long firing lanes.',
    sky: 'sky_crossing', env: 'env_crossing', skyRotation: 0,
    sun: { elevation: 38, azimuth: 101.9, color: '#e6ddd0', intensity: 1.55 },
    hemi: { intensity: 0.8, sky: '#b9bcc0', ground: '#5a554e' },
    envIntensity: 1.2,
    fog: { color: '#7d7a73', density: 0.013 },
    exposure: 1.08, contrast: 1.18, saturation: -24, warmth: 4, shadowDarkness: 0.55,
    ambient: 'ash',
    smokeColumns: [[-50, 18, 1.3], [24, 50, 1.2], [55, -40, 1], [-30, -55, 0.9]],
  },
];
export const MAP_NAMES = MAPS.map(m => m.name);
