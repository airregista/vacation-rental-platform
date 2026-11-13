"use client"

import * as React from "react"

const MOBILE_QUERY = "(max-width: 639px)"

function subscribeMediaQuery(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

/** True only after client hydration; use to gate browser-only rendering. */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribeMediaQuery, getMobileSnapshot, () => false)
}

function subscribeMounted() {
  return () => {}
}

/** True on the client after hydration; false during SSR and the first render. */
export function useIsMounted(): boolean {
  return React.useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  )
}
