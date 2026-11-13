"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPersianDate } from "@/lib/format-fa"
import {
  WEEK_DAYS,
  addDays,
  getPersianParts,
  localTodayIso,
  nextPersianMonthStart,
  persianMonthStart,
  previousPersianMonthStart,
} from "@/lib/persian-calendar"
import { cn } from "@/lib/utils"

const faNumber = new Intl.NumberFormat("fa-IR")

export interface JalaliCalendarProps {
  value: string
  min: string
  onSelect: (isoDate: string) => void
  onClear?: () => void
  className?: string
}

/**
 * A dependency-free Solar Hijri month grid. Dates stay ISO (Gregorian) for the
 * API and are only converted for display, so search params remain unchanged.
 */
export function JalaliCalendar({ value, min, onSelect, onClear, className }: JalaliCalendarProps) {
  const today = React.useMemo(() => localTodayIso(), [])
  const [viewStart, setViewStart] = React.useState(() => persianMonthStart(value || today))

  const month = getPersianParts(viewStart)
  const leadingBlanks = (new Date(`${viewStart}T00:00:00Z`).getUTCDay() + 1) % 7

  const days: { iso: string; day: number }[] = []
  let cursor = viewStart
  while (days.length < 31) {
    const parts = getPersianParts(cursor)
    if (parts.key !== month.key) break
    days.push({ iso: cursor, day: parts.day })
    cursor = addDays(cursor, 1)
  }

  const previousDisabled = Boolean(min) && addDays(viewStart, -1) < min

  return (
    <div className={cn("w-full select-none", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setViewStart(previousPersianMonthStart(viewStart))}
          disabled={previousDisabled}
          aria-label="ماه قبل"
          className="size-8 min-h-8 min-w-8 rounded-full text-ink-soft hover:bg-paper-deep hover:text-ink"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <span className="text-sm font-black text-ink">{month.title}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setViewStart(nextPersianMonthStart(viewStart))}
          aria-label="ماه بعد"
          className="size-8 min-h-8 min-w-8 rounded-full text-ink-soft hover:bg-paper-deep hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_DAYS.map((day) => (
          <span key={day} className="py-1 text-[11px] font-bold text-ink-soft">
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {days.map(({ iso, day }) => {
          const selected = iso === value
          const isToday = iso === today
          const disabled = Boolean(min) && iso < min

          return (
            <Button
              key={iso}
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSelect(iso)}
              disabled={disabled}
              aria-label={formatPersianDate(iso)}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "size-9 min-h-9 min-w-9 rounded-xl text-xs font-bold tabular-nums",
                selected
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  : isToday
                    ? "border border-primary/40 text-primary hover:bg-paper-deep"
                    : "text-ink hover:bg-paper-deep",
                disabled && "opacity-30",
              )}
            >
              {faNumber.format(day)}
            </Button>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line/70 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect(today)}
          disabled={Boolean(min) && today < min}
          className="h-8 rounded-full px-3 text-xs font-bold text-ink-soft hover:bg-paper-deep hover:text-ink"
        >
          امروز
        </Button>
        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 rounded-full px-3 text-xs font-bold text-ink-soft hover:bg-paper-deep hover:text-ink"
          >
            پاک کردن
          </Button>
        ) : null}
      </div>
    </div>
  )
}
