const SAFE_NEXT_DEFAULT = "/"

/**
 * Only same-origin, relative, backslash-free paths may be redirect targets.
 *
 * The WHATWG URL parser treats `\` like `/`, so a value like `/\evil.com`
 * (or its `%5C` form, which `useSearchParams` has already decoded) resolves
 * to a foreign origin. Backslash/whitespace/control-char rejection is the
 * primary fix; the URL resolution is the structural guarantee.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return SAFE_NEXT_DEFAULT
  if (!value.startsWith("/") || value.startsWith("//")) return SAFE_NEXT_DEFAULT
  if (/[\\\s\u0000-\u001f]|%5c/i.test(value)) return SAFE_NEXT_DEFAULT
  // Belt-and-braces: resolve against a fixed origin and require same origin.
  try {
    const resolved = new URL(value, "https://ashianak.invalid")
    if (resolved.origin !== "https://ashianak.invalid") return SAFE_NEXT_DEFAULT
  } catch {
    return SAFE_NEXT_DEFAULT
  }
  return value
}
