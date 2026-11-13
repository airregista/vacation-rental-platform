import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type StatTone = "brick" | "trust" | "gold" | "ink"

const TONE_CLASSES: Record<StatTone, string> = {
  brick: "bg-brick/10 text-brick",
  trust: "bg-trust/10 text-trust",
  gold: "bg-gold-soft text-gold",
  ink: "bg-paper-deep text-ink",
}

export function HostStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brick",
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: StatTone
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper-card p-4 shadow-soft">
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-bold tracking-wide text-ink-soft">{label}</p>
        <p className="truncate text-xl font-black tabular-nums text-ink">{value}</p>
        {hint ? <p className="truncate text-[11px] text-ink-soft">{hint}</p> : null}
      </div>
      <span
        className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONE_CLASSES[tone])}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
    </div>
  )
}
