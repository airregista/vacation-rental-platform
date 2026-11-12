"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SCENES } from "./scene-registry"
import type { SceneId } from "./scene-types"

export function HeroSceneSwitcher({
  active,
  onSelect,
  autoPlay,
  onToggleAutoPlay,
  className,
}: {
  active: SceneId
  onSelect: (scene: SceneId) => void
  autoPlay: boolean
  onToggleAutoPlay: () => void
  className?: string
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const activeRef = React.useRef<HTMLButtonElement>(null)
  const mounted = React.useRef(false)

  // Keep the active pill in view on narrow screens as rotation advances. Only
  // move the strip horizontally, never the page.
  React.useEffect(() => {
    const scroller = scrollerRef.current
    const pill = activeRef.current
    if (!scroller || !pill) return

    const container = scroller.getBoundingClientRect()
    const item = pill.getBoundingClientRect()
    const fullyVisible = item.left >= container.left && item.right <= container.right
    if (fullyVisible) {
      mounted.current = true
      return
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    scroller.scrollBy({
      left: item.left + item.width / 2 - (container.left + container.width / 2),
      behavior: mounted.current && !reduced ? "smooth" : "auto",
    })
    mounted.current = true
  }, [active])

  return (
    <div
      className={cn("flex min-w-0 items-center gap-2 sm:justify-center", className)}
      role="group"
      aria-label="انتخاب اقلیم صحنه"
    >
      <span className="hidden shrink-0 text-[10px] font-semibold text-muted-foreground sm:inline">
        اقلیم
      </span>
      <div
        ref={scrollerRef}
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto sm:flex-initial sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SCENES.map((scene) => (
          <Button
            key={scene.id}
            ref={active === scene.id ? activeRef : undefined}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active === scene.id}
            aria-label={`${scene.label} — ${scene.climate}`}
            title={scene.climate}
            onClick={() => onSelect(scene.id)}
            className={cn(
              "h-9 shrink-0 gap-1.5 rounded-full px-3 text-[11px] font-semibold",
              active === scene.id
                ? "border border-border bg-card text-foreground shadow-sm hover:bg-card"
                : "text-muted-foreground"
            )}
          >
            <scene.Icon className="size-3.5" aria-hidden="true" />
            <span>{scene.label}</span>
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          autoPlay ? "توقف چرخش خودکار اقلیم‌ها" : "شروع چرخش خودکار اقلیم‌ها"
        }
        title={autoPlay ? "توقف چرخش خودکار" : "شروع چرخش خودکار"}
        onClick={onToggleAutoPlay}
        className="size-9 min-h-9 min-w-9 shrink-0 rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted"
      >
        {autoPlay ? (
          <Pause className="size-3.5" aria-hidden="true" />
        ) : (
          <Play className="size-3.5" aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}
