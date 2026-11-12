"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatFaNumber } from "./host-utils"

export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-card p-3.5">
      <div className="min-w-0 space-y-0.5">
        <span className="block text-sm font-bold text-ink">{label}</span>
        {hint ? <span className="block text-[11px] text-ink-soft">{hint}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`کاهش ${label}`}
          className="size-9 min-h-9 min-w-9 rounded-full border-line bg-paper text-ink hover:bg-paper-deep"
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="w-8 text-center text-sm font-black tabular-nums text-ink">
          {formatFaNumber(value)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`افزایش ${label}`}
          className="size-9 min-h-9 min-w-9 rounded-full border-line bg-paper text-ink hover:bg-paper-deep"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
