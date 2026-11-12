"use client"

import * as React from "react"
import { ArrowLeft, MapPin, PlayCircle, Sparkles, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DioramaScene } from "./diorama-scene"
import { HeroPoster } from "./hero-poster"
import { HeroSceneSwitcher } from "./hero-scene-switcher"
import { getScene, SCENES } from "./scene-registry"
import type { SceneId } from "./scene-types"
import { useHeroRotation } from "./use-hero-rotation"
import { useHeroScene } from "./use-hero-scene"
import { useSceneQuality, type SceneQuality } from "./use-scene-quality"

export type QualityPreference = "auto" | SceneQuality

const STATS = [
  { value: "۱٬۲۰۰+", label: "اقامتگاه دست‌چین‌شده" },
  { value: "۳۱", label: "استان" },
  { value: "۴٫۹", label: "امتیاز مهمانان" },
]

export function HeroSection({
  qualityPreference = "auto",
}: {
  qualityPreference?: QualityPreference
}) {
  const detected = useSceneQuality()
  const quality = qualityPreference === "auto" ? detected : qualityPreference
  const showScene = quality !== "poster"
  const [readyQuality, setReadyQuality] = React.useState<SceneQuality | null>(null)
  const sceneReady = readyQuality === quality

  const [scene, selectScene] = useHeroScene()
  const activeScene = getScene(scene)
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null)

  const advanceScene = React.useCallback(() => {
    const index = SCENES.findIndex((item) => item.id === scene)
    const next = SCENES[(index + 1) % SCENES.length]
    selectScene(next.id)
  }, [scene, selectScene])

  const {
    autoPlay,
    pauseForManual,
    toggle: toggleAutoPlay,
    handlers: rotationHandlers,
  } = useHeroRotation({
    cycleKey: scene,
    onAdvance: advanceScene,
  })

  const handleSelect = React.useCallback(
    (next: SceneId) => {
      pauseForManual()
      selectScene(next)
    },
    [pauseForManual, selectScene]
  )

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return
    swipeStart.current = { x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer may already be released (or synthetic); swipe still works.
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return

    const index = SCENES.findIndex((item) => item.id === scene)
    const next = SCENES[dx < 0 ? index + 1 : index - 1]
    if (next) handleSelect(next.id)
  }

  return (
    <section className="relative isolate overflow-x-clip">
      {/* Golden-hour backdrop */}
      <div
        aria-hidden="true"
        className="hero-backdrop absolute inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className="hero-bloom-clay absolute -right-24 -top-28 -z-10 size-[30rem] rounded-full blur-2xl"
      />
      <div
        aria-hidden="true"
        className="hero-bloom-teal absolute -left-32 top-1/3 -z-10 size-[26rem] rounded-full blur-2xl"
      />

      <div className="mx-auto grid w-full max-w-[1360px] items-center gap-4 px-4 pb-4 pt-6 sm:gap-6 sm:px-6 sm:pt-10 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pb-8 lg:pt-12">
        {/* Copy */}
        <div className="flex min-w-0 flex-col items-start gap-4 lg:col-span-5 lg:gap-6">
          <div className="hero-rise inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur">
            <Sparkles className="size-3.5" />
            <span>اقامتگاه‌های بومی ایران</span>
          </div>

          <h1 className="hero-rise text-balance text-[clamp(2.15rem,6.2vw,4.35rem)] font-black leading-[1.24] tracking-tight text-hero-ink [animation-delay:80ms]">
            جایی برای{" "}
            <span className="relative inline-block text-primary">
              آشیان
              <svg
                aria-hidden="true"
                viewBox="0 0 140 14"
                preserveAspectRatio="none"
                className="absolute -bottom-1 left-0 h-3 w-full text-primary/65"
              >
                <path
                  d="M4 10C38 4 78 4 136 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            گرفتن
          </h1>

          <p className="hero-rise max-w-md text-[clamp(0.95rem,1.6vw,1.1rem)] leading-8 text-muted-foreground [animation-delay:160ms]">
            ویلا، سوئیت و کلبه‌های دست‌چین‌شده؛ با میزبان‌هایی که مهمان را خانواده
            می‌دانند.
          </p>

          <div className="hero-rise flex w-full flex-col gap-3 sm:flex-row [animation-delay:240ms]">
            <Button asChild size="lg" className="gap-2 rounded-2xl shadow-lg shadow-primary/20">
              <a href="#results">
                <span>کاوش اقامتگاه‌ها</span>
                <ArrowLeft className="size-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="hidden gap-2 rounded-2xl border-card/80 bg-card/55 backdrop-blur hover:bg-card/80 sm:inline-flex"
            >
              <PlayCircle className="size-4" />
              <span>چطور رزرو کنیم؟</span>
            </Button>
          </div>

          <dl className="hero-rise flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 [animation-delay:320ms] sm:gap-x-7 sm:gap-y-3">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="flex items-baseline gap-1.5">
                  <span className="text-base font-extrabold text-hero-ink sm:text-lg">
                    {stat.value}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
            <div className="hidden items-center gap-1 text-[11px] font-medium text-muted-foreground sm:flex">
              <Star className="size-3.5 fill-secondary text-secondary" />
              <span>میزبانان تأییدشده</span>
            </div>
          </dl>
        </div>

        {/* Diorama */}
        <div className="relative min-w-0 lg:col-span-7" {...rotationHandlers}>
          <div
            aria-hidden="true"
            className="hero-scene-glow absolute inset-x-2 bottom-0 top-10 -z-10 rounded-[50%] blur-2xl"
          />
          <div
            data-scene={scene}
            className="hero-fade relative h-[clamp(280px,40svh,360px)] w-full touch-pan-y sm:h-[clamp(340px,48svh,460px)] lg:h-[min(68svh,600px)]"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              swipeStart.current = null
            }}
          >
            <HeroPoster
              scene={scene}
              className={cn(
                "absolute inset-0 h-full w-full transition-opacity duration-700",
                showScene && sceneReady ? "opacity-0" : "opacity-100"
              )}
            />
            {showScene ? (
              <DioramaScene
                key={quality}
                scene={scene}
                quality={quality}
                onReady={() => setReadyQuality(quality)}
              />
            ) : null}

            <div className="hero-scene-fade pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-20" />
            <div
              key={scene}
              aria-hidden="true"
              className="hero-scene-veil pointer-events-none absolute inset-0 z-10"
            />

            <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-card/80 bg-card/80 px-3 py-1.5 text-[11px] font-semibold text-hero-ink shadow-sm backdrop-blur">
              <MapPin className="size-3.5 text-primary" />
              <span>{activeScene.badge}</span>
            </div>
          </div>

          <HeroSceneSwitcher
            active={scene}
            onSelect={handleSelect}
            autoPlay={autoPlay}
            onToggleAutoPlay={toggleAutoPlay}
            className="mt-2"
          />
        </div>
      </div>
    </section>
  )
}
