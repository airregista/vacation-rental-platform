export const SCENE_IDS = [
  "kashan",
  "forest",
  "desert",
  "mountain",
  "zagros",
  "coast",
] as const

export type SceneId = (typeof SCENE_IDS)[number]

export const DEFAULT_SCENE: SceneId = "kashan"

export function isSceneId(value: string | null): value is SceneId {
  return value !== null && (SCENE_IDS as readonly string[]).includes(value)
}

export type SceneTier = "lite" | "full"
