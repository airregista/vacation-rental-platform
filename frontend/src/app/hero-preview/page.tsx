"use client"

import * as React from "react"
import { HeroSection, type QualityPreference } from "@/components/hero/hero-section"
import { HeroSearchDock } from "@/components/hero/hero-search-dock"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSceneQuality, type SceneQuality } from "@/components/hero/use-scene-quality"
import { StaySlider } from "./stay-slider"

const QUALITY_LABEL: Record<SceneQuality, string> = {
  full: "کامل",
  lite: "سبک",
  poster: "تصویر",
}

function readForcedQuality(): SceneQuality | null {
  const value = new URLSearchParams(window.location.search).get("quality")
  return value === "full" || value === "lite" || value === "poster" ? value : null
}

function subscribeToUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  return () => window.removeEventListener("popstate", onChange)
}

/** Preview-only page frame rate, to judge the scene on real devices. */
function useFps() {
  const [fps, setFps] = React.useState(0)

  React.useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0

    const tick = (now: number) => {
      frames += 1
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return fps
}

export default function HeroPreviewPage() {
  const detected = useSceneQuality()
  const [manual, setManual] = React.useState<QualityPreference | null>(null)
  const forced = React.useSyncExternalStore(subscribeToUrl, readForcedQuality, () => null)
  const preference: QualityPreference = manual ?? forced ?? "auto"
  const effective: SceneQuality = preference === "auto" ? detected : preference
  const fps = useFps()

  return (
    <div className="relative flex flex-col">
      <HeroSection qualityPreference={preference} />

      {/* Search dock — sticky over the results while browsing */}
      <div className="sticky top-[65px] z-30 mt-2 px-4 sm:px-6 md:-mt-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <HeroSearchDock />
        </div>
      </div>

      <section
        id="results"
        aria-label="نمونهٔ اقامتگاه‌ها"
        className="mx-auto w-full max-w-[1360px] scroll-mt-36 px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
      >
        <StaySlider />
      </section>

      {/* Prototype-only quality switch (desktop; phones use ?quality=lite) */}
      <div className="absolute left-4 top-20 z-50 hidden md:block">
        <div className="rounded-2xl border border-border bg-background/95 p-1.5 shadow-xl backdrop-blur md:p-2">
          <div className="flex items-center justify-between gap-3 px-1.5 pb-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground">
              پیش‌نمایش صحنه
            </p>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {QUALITY_LABEL[effective]} · {fps > 0 ? `${fps.toLocaleString("fa-IR")} فریم/ث` : "—"}
            </span>
          </div>
          <Tabs
            value={preference}
            onValueChange={(value) => setManual(value as QualityPreference)}
          >
            <TabsList className="h-8 md:h-9">
              <TabsTrigger value="auto" className="px-2 text-[11px] md:px-2.5 md:text-xs">
                خودکار
              </TabsTrigger>
              <TabsTrigger value="full" className="px-2 text-[11px] md:px-2.5 md:text-xs">
                کامل
              </TabsTrigger>
              <TabsTrigger value="lite" className="px-2 text-[11px] md:px-2.5 md:text-xs">
                سبک
              </TabsTrigger>
              <TabsTrigger value="poster" className="px-2 text-[11px] md:px-2.5 md:text-xs">
                تصویر
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
