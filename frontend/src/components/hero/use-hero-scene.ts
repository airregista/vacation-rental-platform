"use client"

import * as React from "react"
import { DEFAULT_SCENE, isSceneId, type SceneId } from "./scene-types"

const SCENE_EVENT = "hero-scene-change"

function readSceneFromUrl(): SceneId {
  if (typeof window === "undefined") return DEFAULT_SCENE
  const value = new URLSearchParams(window.location.search).get("scene")
  return isSceneId(value) ? value : DEFAULT_SCENE
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  window.addEventListener(SCENE_EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(SCENE_EVENT, onChange)
  }
}

/**
 * The active diorama is URL-driven so the prototype can deep-link a climate
 * (`?scene=forest`). Swapping keeps the rest of the query string intact.
 */
export function useHeroScene() {
  const scene = React.useSyncExternalStore(subscribe, readSceneFromUrl, () => DEFAULT_SCENE)

  const selectScene = React.useCallback((next: SceneId) => {
    const url = new URL(window.location.href)
    if (next === DEFAULT_SCENE) {
      url.searchParams.delete("scene")
    } else {
      url.searchParams.set("scene", next)
    }
    window.history.replaceState(null, "", url)
    window.dispatchEvent(new Event(SCENE_EVENT))
  }, [])

  return [scene, selectScene] as const
}
