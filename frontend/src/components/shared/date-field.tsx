"use client"

import * as React from "react"
import { formatPersianDate } from "@/lib/format-fa"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { JalaliCalendar } from "./jalali-calendar"

export interface JalaliDateFieldProps {
  label: string
  value: string
  min?: string
  ariaLabel?: string
  onChange: (value: string) => void
  boxed?: boolean
}

/**
 * A Solar Hijri picker: the trigger shows the Persian date, and the popover
 * renders a Jalali month grid instead of the browser's Gregorian calendar.
 */
export function JalaliDateField({
  label,
  value,
  min = "",
  ariaLabel,
  onChange,
  boxed = false,
}: JalaliDateFieldProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? label}
          aria-haspopup="dialog"
          className={cn(
            "flex cursor-pointer flex-col gap-0.5 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[state=open]:bg-muted/60",
            boxed
              ? "w-full rounded-xl border border-input bg-background px-3 py-2"
              : "-mx-1.5 rounded-lg px-1.5 py-0.5 hover:bg-muted/60"
          )}
        >
          <span
            className={cn(
              "font-bold",
              boxed
                ? "text-[11px] text-muted-foreground"
                : "text-[11px] text-foreground"
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "whitespace-nowrap font-medium tabular-nums",
              boxed ? "text-sm" : "text-xs",
              value ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {value ? formatPersianDate(value) : "انتخاب تاریخ"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[19rem] rounded-2xl border-line bg-popover p-3 text-popover-foreground shadow-lift"
      >
        <JalaliCalendar
          value={value}
          min={min}
          onSelect={(isoDate) => {
            onChange(isoDate)
            setOpen(false)
          }}
          onClear={
            value
              ? () => {
                  onChange("")
                  setOpen(false)
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  )
}
