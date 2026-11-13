"use client"

import * as React from "react"

const AUTO_ADVANCE_MS = 5000
const MANUAL_PAUSE_MS = 10000

// Captured once per page load: a scene in the URL is an explicit choice.
let initialSceneLink: boolean | null = null

function subscribeNever() {
  return () => {}
}

function getInitialSceneLink() {
  if (initialSceneLink === null) {
    initialSceneLink = new URLSearchParams(window.location.search).has("scene")
  }
  return initialSceneLink
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

function getHidden() {
  return document.visibilityState === "hidden"
}

/**
 * Drives the diorama carousel: advances every five seconds, pauses while the
 * visitor hovers, focuses or leaves the tab, and gives a manual scene change a
 * ten-second head start before rotation resumes.
 */
export function useHeroRotation({
  cycleKey,
  onAdvance,
}: {
  cycleKey: string
  onAdvance: () => void
}) {
  const startPaused = React.useSyncExternalStore(subscribeNever, getInitialSceneLink, () => false)
  const reducedMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  )
  const hidden = React.useSyncExternalStore(subscribeVisibility, getHidden, () => false)

  const [autoPreference, setAutoPreference] = React.useState<boolean | null>(null)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [manualPauseUntil, setManualPauseUntil] = React.useState(0)
  const advanceRef = React.useRef(onAdvance)

  React.useEffect(() => {
    advanceRef.current = onAdvance
  }, [onAdvance])

  const autoPlay = autoPreference ?? (!startPaused && !reducedMotion)

  const pauseForManual = React.useCallback(() => {
    // Choosing a scene is explicit intent; release a keyboard-focus pause so
    // rotation can resume once the ten-second head start is over.
    setFocused(false)
    setManualPauseUntil(Date.now() + MANUAL_PAUSE_MS)
  }, [])

  const toggle = React.useCallback(() => {
    const current = autoPreference ?? (!startPaused && !reducedMotion)
    const next = !current
    setManualPauseUntil(0)
    setAutoPreference(next)
    if (next) {
      // Pressing play is explicit; don't stay paused just because the control
      // that was activated (or the scene it sits in) still has focus/hover.
      setHovered(false)
      setFocused(false)
    }
  }, [autoPreference, startPaused, reducedMotion])

  const paused = !autoPlay || hovered || focused || hidden

  React.useEffect(() => {
    if (paused) return
    const remaining = manualPauseUntil - Date.now()
    const timer = window.setTimeout(
      () => advanceRef.current(),
      remaining > 0 ? remaining : AUTO_ADVANCE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [paused, cycleKey, manualPauseUntil])

  return {
    autoPlay,
    pauseForManual,
    toggle,
    handlers: {
      onPointerEnter: (event: React.PointerEvent) => {
        if (event.pointerType === "mouse") setHovered(true)
      },
      onPointerLeave: (event: React.PointerEvent) => {
        if (event.pointerType === "mouse") setHovered(false)
      },
      onFocus: (event: React.FocusEvent) => {
        // Mouse clicks also focus buttons; only keyboard focus should halt
        // the carousel, otherwise a clicked pill would pause it forever.
        if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
          setFocused(true)
        }
      },
      onBlur: () => setFocused(false),
    },
  }
}
