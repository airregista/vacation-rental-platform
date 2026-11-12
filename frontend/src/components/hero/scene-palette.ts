/**
 * Three.js can't consume Tailwind utilities, so the material palette is read
 * from the same CSS custom properties defined in `globals.css`. This keeps the
 * 3D scene and the DOM on one source of truth.
 */
export interface ScenePalette {
  sand: string
  sandDeep: string
  plaster: string
  plasterShade: string
  clay: string
  clayDeep: string
  teal: string
  tealDeep: string
  green: string
  greenDeep: string
  wood: string
  gold: string
  cream: string
  red: string
  ink: string
  glow: string
  ember: string
  stone: string
  snow: string
  mist: string
  tent: string
  coral: string
  lightWarm: string
  lightSky: string
  lightGround: string
  lightKey: string
  lightRim: string
}

const TOKENS: Record<keyof ScenePalette, string> = {
  sand: "--hero-sand",
  sandDeep: "--hero-sand-deep",
  plaster: "--hero-plaster",
  plasterShade: "--hero-plaster-shade",
  clay: "--hero-clay",
  clayDeep: "--hero-clay-deep",
  teal: "--hero-teal",
  tealDeep: "--hero-teal-deep",
  green: "--hero-green",
  greenDeep: "--hero-green-deep",
  wood: "--hero-wood",
  gold: "--hero-gold",
  cream: "--hero-cream",
  red: "--hero-red",
  ink: "--hero-ink",
  glow: "--hero-glow",
  ember: "--hero-ember",
  stone: "--hero-stone",
  snow: "--hero-snow",
  mist: "--hero-mist",
  tent: "--hero-tent",
  coral: "--hero-coral",
  lightWarm: "--hero-light-warm",
  lightSky: "--hero-light-sky",
  lightGround: "--hero-light-ground",
  lightKey: "--hero-light-key",
  lightRim: "--hero-light-rim",
}

let cached: ScenePalette | null = null

export function getScenePalette(): ScenePalette {
  if (cached) return cached

  const styles = getComputedStyle(document.documentElement)
  const palette = {} as ScenePalette
  for (const [key, token] of Object.entries(TOKENS)) {
    palette[key as keyof ScenePalette] = styles.getPropertyValue(token).trim()
  }
  cached = palette
  return palette
}
