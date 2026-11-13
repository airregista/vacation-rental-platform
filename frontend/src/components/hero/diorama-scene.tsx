"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import type { SceneId, SceneTier } from "./scene-types"

const DioramaCanvas = dynamic(() => import("./diorama-canvas"), {
  ssr: false,
  loading: () => null,
})

/**
 * Hosts the WebGL canvas: mounts after first paint, fades in when the first
 * frame is ready, and stops rendering when scrolled away or tabbed out.
 */
export function DioramaScene({
  scene,
  quality,
  className,
  onReady,
}: {
  scene: SceneId
  quality: SceneTier
  className?: string
  onReady?: () => void
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)
  const [inView, setInView] = React.useState(true)
  const [visible, setVisible] = React.useState(true)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    // Wait for the first paint (and the browser's idle window) before paying
    // for the three.js bundle and context creation.
    let idleHandle = 0
    let timeoutHandle = 0
    const mount = () => setMounted(true)

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(mount, { timeout: 900 })
    } else {
      timeoutHandle = window.setTimeout(mount, 120)
    }

    return () => {
      if (idleHandle) window.cancelIdleCallback(idleHandle)
      if (timeoutHandle) window.clearTimeout(timeoutHandle)
    }
  }, [])

  React.useEffect(() => {
    const node = hostRef.current
    if (!node) return

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.01,
    })
    observer.observe(node)

    const onVisibility = () => setVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const active = inView && visible

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {mounted ? (
        <DioramaCanvas
          scene={scene}
          quality={quality}
          active={active}
          onReady={() => {
            setReady(true)
            onReady?.()
          }}
        />
      ) : null}
    </div>
  )
}
