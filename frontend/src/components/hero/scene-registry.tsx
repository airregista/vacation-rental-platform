import type { ComponentType } from "react"
import { Landmark, Mountain, Sun, Tent, Trees, Waves, type LucideIcon } from "lucide-react"
import type { SceneId, SceneTier } from "./scene-types"

/** A resolved hero scene component, rendered inside the diorama canvas. */
export type HeroSceneComponent = ComponentType<{ quality: SceneTier }>

export interface HeroSceneDefinition {
  id: SceneId
  label: string
  badge: string
  climate: string
  Icon: LucideIcon
  /**
   * Lazy loader for the scene component. Scene modules pull in three.js, so
   * they are only reachable through these dynamic imports — that keeps them
   * out of the homepage's initial bundle.
   */
  loadScene: () => Promise<{ Scene: HeroSceneComponent }>
}

export const SCENES: HeroSceneDefinition[] = [
  {
    id: "kashan",
    label: "خشک مرکزی",
    badge: "حیاط ایرانی · کاشان",
    climate: "گرم و خشک",
    Icon: Landmark,
    loadScene: () => import("./scenes/kashan").then((m) => ({ Scene: m.KashanScene })),
  },
  {
    id: "forest",
    label: "جنگل",
    badge: "جنگل هیرکانی · ماسوله",
    climate: "معتدل و مرطوب",
    Icon: Trees,
    loadScene: () => import("./scenes/forest").then((m) => ({ Scene: m.ForestScene })),
  },
  {
    id: "desert",
    label: "کویر",
    badge: "خانهٔ خشتی · یزد",
    climate: "بیابانی",
    Icon: Sun,
    loadScene: () => import("./scenes/desert").then((m) => ({ Scene: m.DesertScene })),
  },
  {
    id: "mountain",
    label: "کوهستان",
    badge: "کوهستان سبلان · اردبیل",
    climate: "سرد کوهستانی",
    Icon: Mountain,
    loadScene: () => import("./scenes/mountain").then((m) => ({ Scene: m.MountainScene })),
  },
  {
    id: "zagros",
    label: "زاگرس",
    badge: "سیاه‌چادر · زاگرس",
    climate: "نیمه‌خشک کوهپایه‌ای",
    Icon: Tent,
    loadScene: () => import("./scenes/zagros").then((m) => ({ Scene: m.ZagrosScene })),
  },
  {
    id: "coast",
    label: "ساحلی",
    badge: "ساحل بندر لنگه",
    climate: "گرم و مرطوب",
    Icon: Waves,
    loadScene: () => import("./scenes/coast").then((m) => ({ Scene: m.CoastScene })),
  },
]

const SCENE_MAP: Record<SceneId, HeroSceneDefinition> = SCENES.reduce(
  (map, scene) => {
    map[scene.id] = scene
    return map
  },
  {} as Record<SceneId, HeroSceneDefinition>,
)

/**
 * Metadata lookup (label/badge/climate/icon + lazy loader). This never
 * returns a scene component synchronously — use `loadScene()` for that.
 */
export function getScene(id: SceneId): HeroSceneDefinition {
  return SCENE_MAP[id]
}
