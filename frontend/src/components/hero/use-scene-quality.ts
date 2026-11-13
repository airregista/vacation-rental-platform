"use client"

import * as React from "react"

export type SceneQuality = "poster" | "lite" | "full"

let webglSupport: boolean | null = null

function supportsWebGL(): boolean {
  if (webglSupport !== null) return webglSupport
  try {
    const canvas = document.createElement("canvas")
    webglSupport = Boolean(
      window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    )
  } catch {
    webglSupport = false
  }
  return webglSupport
}

/**
 * Picks the heaviest scene the current device can comfortably render.
 * - `poster`  → reduced motion, no WebGL, or very low memory
 * - `lite`    → phones/tablets and touch devices (no shadow maps)
 * - `full`    → desktop with a fine pointer
 */
export function detectSceneQuality(): SceneQuality {
  if (typeof window === "undefined") return "poster"
  if (!supportsWebGL()) return "poster"
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "poster"

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof memory === "number" && memory <= 2) return "poster"

  const small = window.matchMedia("(max-width: 767px)").matches
  const coarse = window.matchMedia("(pointer: coarse)").matches
  return small || coarse ? "lite" : "full"
}

function subscribe(onChange: () => void) {
  const queries = [
    window.matchMedia("(max-width: 767px)"),
    window.matchMedia("(pointer: coarse)"),
    window.matchMedia("(prefers-reduced-motion: reduce)"),
  ]
  queries.forEach((query) => query.addEventListener("change", onChange))
  return () => queries.forEach((query) => query.removeEventListener("change", onChange))
}

/**
 * `useSyncExternalStore` keeps the server snapshot deterministic ("poster")
 * and avoids a state-in-effect hydration flash.
 */
export function useSceneQuality(): SceneQuality {
  return React.useSyncExternalStore(subscribe, detectSceneQuality, () => "poster" as const)
}
