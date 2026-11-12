"use client"

import * as React from "react"
import { Direction } from "radix-ui"

/**
 * Radix primitives (radio groups, dropdown menus, sliders…) read their
 * direction from context and default to `ltr`, which overrides the page's
 * `dir="rtl"` on those elements. One provider fixes all of them.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  return <Direction.Provider dir="rtl">{children}</Direction.Provider>
}
