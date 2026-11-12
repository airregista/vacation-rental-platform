"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { applyTheme, isTheme, THEME_KEY, type Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"

const NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
}

const LABEL: Record<Theme, string> = {
  light: "روشن",
  dark: "تاریک",
  system: "همراه با سیستم",
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener("ashianak-theme", callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener("ashianak-theme", callback)
  }
}

function getSnapshot(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY)
  return isTheme(stored) ? stored : "light"
}

function getServerSnapshot(): Theme {
  return "light"
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  React.useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function cycle() {
    const next = NEXT[theme]
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // Private mode: the theme still applies for this visit.
    }
    applyTheme(next)
    window.dispatchEvent(new Event("ashianak-theme"))
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      shape="pill"
      onClick={cycle}
      aria-label={`حالت نمایش: ${LABEL[theme]} — تغییر به ${LABEL[NEXT[theme]]}`}
      title={`حالت نمایش: ${LABEL[theme]}`}
      className={cn(className)}
    >
      <Icon className="size-4" />
    </Button>
  )
}
