import * as React from "react"
import { cn } from "@/lib/utils"

type AshianakLogoTone = "default" | "night" | "hero"

type AshianakLogoProps = {
  /** "mark" renders the nest logomark alone; "lockup" adds the brand name. */
  variant?: "mark" | "lockup"
  /** Surface the logo sits on. "night" is for surfaces that stay dark in both themes (footer). */
  tone?: AshianakLogoTone
  /** Overall lockup scale. */
  size?: "md" | "lg"
  /** Show the small Latin wordmark under the Persian name. */
  withLatin?: boolean
  className?: string
}

/* The mark's palette lives in globals.css as --mark-* tokens so it follows the
   light/dark theme like every other surface; `tone="night"` opts into the
   .logo-on-night re-map for always-dark surfaces. SVG presentation attributes
   cannot resolve var() reliably, so paints go through inline styles. */
const paint = {
  line: { stroke: "var(--mark-line)" },
  lineSoft: { stroke: "var(--mark-line-soft)" },
  body: { fill: "var(--mark-body)" },
  accent: { fill: "var(--mark-accent)" },
  accentLine: { stroke: "var(--mark-accent)" },
} satisfies Record<string, React.CSSProperties>

const NAME_TONE: Record<AshianakLogoTone, string> = {
  default: "text-ink",
  night: "text-night-foreground",
  hero: "text-hero-ink",
}

const LATIN_TONE: Record<AshianakLogoTone, string> = {
  default: "text-ink-soft",
  night: "text-night-foreground/60",
  hero: "text-hero-ink/60",
}

const SIZE = {
  md: { mark: "size-9", name: "text-lg" },
  lg: { mark: "size-12", name: "text-xl" },
}

/**
 * The Ashianak logomark: a Persian arch framing a cottage resting in a nest,
 * with a bird coming home. Geometry is traced from the brand SVGs in
 * `frontend/logo/`; the source art's clipPath is replaced by trimming the
 * cottage/doorway bottoms (y=203.5) and arch legs (y=186) so they end inside
 * the rim stroke's band — the rim is drawn last and covers those seams, so
 * no clipPath id (and therefore no client component) is needed.
 */
function LogoMark({ className, night }: { className?: string; night?: boolean }) {
  return (
    <svg
      viewBox="100 38 200 200"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(night && "logo-on-night", className)}
    >
      <g>
        {/* Persian arch frame */}
        <path
          d="M 128 186 L 128 130 C 128 85, 162 62, 200 48 C 238 62, 272 85, 272 130 L 272 186"
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={paint.line}
        />
        {/* Cottage body — bottom edge hides under the nest rim stroke */}
        <path
          d="M 200 115 L 237 150 L 237 203.5 L 163 203.5 L 163 150 Z"
          style={paint.body}
        />
        {/* Doorway */}
        <path
          d="M 190 203.5 L 190 181 A 10 10 0 0 1 210 181 L 210 203.5 Z"
          style={paint.accent}
        />
        {/* Gable roof */}
        <path
          d="M 152 159 L 200 113 L 248 159"
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={paint.lineSoft}
        />
        {/* Round window */}
        <circle cx={200} cy={143} r={7.5} style={paint.accent} />
        {/* Bird coming home */}
        <path
          d="M 220 95 C 224 93, 229 94, 233 96 C 238 89, 244 85, 250 84 C 248 91, 244 97, 239 100 C 243 102, 247 106, 249 110 C 243 108, 237 106, 231 104 C 226 102, 223 99, 220 95 Z"
          style={paint.lineSoft}
        />
      </g>
      {/* Nest weave, drawn last so it overlays the cottage seam */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M 114 182 C 146 244, 254 244, 286 182"
          strokeWidth={7.5}
          style={paint.accentLine}
        />
        <path
          d="M 142 212 C 185 238, 242 228, 276 192"
          strokeWidth={6.5}
          style={paint.accentLine}
        />
        <path
          d="M 110 175 C 140 226, 248 222, 284 182"
          strokeWidth={7}
          style={paint.accentLine}
        />
        <path
          d="M 110 172 C 134 216, 266 216, 290 172"
          strokeWidth={7.5}
          style={paint.line}
        />
      </g>
    </svg>
  )
}

export function AshianakLogo({
  variant = "lockup",
  tone = "default",
  size = "md",
  withLatin = true,
  className,
}: AshianakLogoProps) {
  if (variant === "mark") {
    return (
      <span aria-hidden="true" className={cn("block size-9 shrink-0", className)}>
        <LogoMark night={tone === "night"} className="size-full" />
      </span>
    )
  }

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark night={tone === "night"} className={SIZE[size].mark} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-black tracking-tight", SIZE[size].name, NAME_TONE[tone])}>
          آشیانک
        </span>
        {withLatin ? (
          <span
            dir="ltr"
            className={cn(
              "mt-1 text-[11px] font-semibold tracking-[0.18em]",
              LATIN_TONE[tone]
            )}
          >
            Ashianak
          </span>
        ) : null}
      </span>
    </span>
  )
}
