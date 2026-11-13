import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type AdminTone = "positive" | "warning" | "danger" | "neutral" | "brand"

const TONE_CLASSES: Record<AdminTone, string> = {
  positive: "border-trust/25 bg-trust-soft/70 text-trust",
  warning: "border-gold/30 bg-gold-soft/70 text-ink",
  danger: "border-brick/25 bg-brick/10 text-brick",
  neutral: "border-line bg-paper-deep/60 text-ink-soft",
  brand: "border-brick/25 bg-brick/10 text-brick",
}

export function AdminStatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: AdminTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
