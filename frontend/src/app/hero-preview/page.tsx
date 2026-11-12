"use client"

import * as React from "react"
import { Settings2 } from "lucide-react"
import { HeroSection, type QualityPreference } from "@/components/hero/hero-section"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSceneQuality, type SceneQuality } from "@/components/hero/use-scene-quality"

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

/** Preview-only frame rate, to judge the scene on real devices. */
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
  const [controlsOpen, setControlsOpen] = React.useState(false)
  const forced = React.useSyncExternalStore(subscribeToUrl, readForcedQuality, () => null)
  const preference: QualityPreference = manual ?? forced ?? "auto"
  const effective: SceneQuality = preference === "auto" ? detected : preference
  const fps = useFps()

  return (
    <div className="hero-tokens bg-paper text-ink">
      <HeroSection qualityPreference={preference} />

      <div className="fixed bottom-5 right-5 z-50 hidden flex-col items-end xl:flex">
        {controlsOpen ? (
          <div
            id="quality-controls"
            className="mb-2 rounded-2xl border border-line bg-paper/95 p-2 shadow-lift backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3 px-1.5 pb-1.5">
              <p className="text-[11px] font-semibold text-ink-soft">پیش‌نمایش صحنه</p>
              <span className="text-[11px] tabular-nums text-ink-soft">
                {QUALITY_LABEL[effective]} ·{" "}
                {fps > 0 ? `${fps.toLocaleString("fa-IR")} فریم/ث` : "—"}
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
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="icon"
          shape="pill"
          onClick={() => setControlsOpen((open) => !open)}
          aria-expanded={controlsOpen}
          aria-controls="quality-controls"
          aria-label={`کیفیت صحنه · ${QUALITY_LABEL[effective]}`}
          title={`کیفیت صحنه · ${QUALITY_LABEL[effective]}`}
          className="border-line bg-paper/95 text-ink shadow-lift backdrop-blur hover:bg-paper"
        >
          <Settings2 className="size-4 text-brick" />
        </Button>
      </div>
    </div>
  )
}
