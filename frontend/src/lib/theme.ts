export type Theme = "light" | "dark" | "system"

export const THEME_KEY = "ashianak-theme"

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

export function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark())
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}
