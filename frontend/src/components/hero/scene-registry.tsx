import type { ComponentType } from "react"
import { Landmark, Mountain, Sun, Tent, Trees, Waves, type LucideIcon } from "lucide-react"
import { CoastScene } from "./scenes/coast"
import { DesertScene } from "./scenes/desert"
import { ForestScene } from "./scenes/forest"
import { KashanScene } from "./scenes/kashan"
import { MountainScene } from "./scenes/mountain"
import { ZagrosScene } from "./scenes/zagros"
import type { SceneId, SceneTier } from "./scene-types"

export interface HeroSceneDefinition {
  id: SceneId
  label: string
  badge: string
  climate: string
  Icon: LucideIcon
  Scene: ComponentType<{ quality: SceneTier }>
}

export const SCENES: HeroSceneDefinition[] = [
  {
    id: "kashan",
    label: "خشک مرکزی",
    badge: "حیاط ایرانی · کاشان",
    climate: "گرم و خشک",
    Icon: Landmark,
    Scene: KashanScene,
  },
  {
    id: "forest",
    label: "جنگل",
    badge: "جنگل هیرکانی · ماسوله",
    climate: "معتدل و مرطوب",
    Icon: Trees,
    Scene: ForestScene,
  },
  {
    id: "desert",
    label: "کویر",
    badge: "خانهٔ خشتی · یزد",
    climate: "بیابانی",
    Icon: Sun,
    Scene: DesertScene,
  },
  {
    id: "mountain",
    label: "کوهستان",
    badge: "کوهستان سبلان · اردبیل",
    climate: "سرد کوهستانی",
    Icon: Mountain,
    Scene: MountainScene,
  },
  {
    id: "zagros",
    label: "زاگرس",
    badge: "سیاه‌چادر · زاگرس",
    climate: "نیمه‌خشک کوهپایه‌ای",
    Icon: Tent,
    Scene: ZagrosScene,
  },
  {
    id: "coast",
    label: "ساحلی",
    badge: "ساحل خلیج فارس · کنگ",
    climate: "گرم و مرطوب",
    Icon: Waves,
    Scene: CoastScene,
  },
]

const SCENE_MAP: Record<SceneId, HeroSceneDefinition> = SCENES.reduce(
  (map, scene) => {
    map[scene.id] = scene
    return map
  },
  {} as Record<SceneId, HeroSceneDefinition>
)

export function getScene(id: SceneId): HeroSceneDefinition {
  return SCENE_MAP[id]
}
