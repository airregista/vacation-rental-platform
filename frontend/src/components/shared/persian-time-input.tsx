"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { toPersianDigits } from "@/lib/format-fa"

function normalizeTimeInput(value: string): string {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d:]/g, "")

  // Typing four digits without a colon is the common case on a numpad.
  if (/^\d{3,4}$/.test(digits)) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`
  }
  return digits
}

function formatTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return value
  return toPersianDigits(`${match[1].padStart(2, "0")}:${match[2]}`)
}

export interface PersianTimeInputProps
  extends Omit<
    React.ComponentProps<typeof Input>,
    "type" | "value" | "defaultValue" | "onChange"
  > {
  /** 24-hour `HH:MM` value. */
  value: string
  onValueChange: (value: string) => void
}

/** 24-hour time field that renders Persian digits instead of the browser's locale picker. */
export function PersianTimeInput({
  value,
  onValueChange,
  onBlur,
  ...props
}: PersianTimeInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [text, setText] = React.useState(() => formatTime(value))

  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(formatTime(value))
    }
  }, [value])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeTimeInput(event.target.value)
    setText(toPersianDigits(normalized))

    const match = /^(\d{1,2}):(\d{2})$/.exec(normalized)
    if (!match) return
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours > 23 || minutes > 59) return
    onValueChange(`${String(hours).padStart(2, "0")}:${match[2]}`)
  }

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={text}
      onChange={handleChange}
      onBlur={(event) => {
        setText(formatTime(value))
        onBlur?.(event)
      }}
      className={props.className}
    />
  )
}
