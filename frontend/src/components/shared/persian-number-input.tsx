"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { toPersianDigits } from "@/lib/format-fa"

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/[٬،,\s]/g, "")
}

function formatValue(value: number | null | undefined, allowDecimal: boolean): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ""
  const text = allowDecimal ? String(value) : String(Math.trunc(value))
  return toPersianDigits(text).replace(".", "٫")
}

export interface PersianNumberInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange"
> {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  allowDecimal?: boolean
  /** Value emitted when the field is cleared. Defaults to 0. */
  emptyValue?: number | null
}

/**
 * Numeric input that shows Persian digits while keeping a numeric value for
 * forms and APIs. Native `type="number"` cannot render Persian digits, so this
 * uses a text input with `inputMode="numeric"` and normalizes Persian/Arabic
 * digits and separators on every keystroke.
 */
export function PersianNumberInput({
  value,
  onValueChange,
  allowDecimal = false,
  emptyValue = 0,
  onBlur,
  ...props
}: PersianNumberInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [text, setText] = React.useState(() => formatValue(value, allowDecimal))

  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(formatValue(value, allowDecimal))
    }
  }, [value, allowDecimal])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeDigits(event.target.value)
    const cleaned = allowDecimal
      ? normalized.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
      : normalized.replace(/\D/g, "")

    setText(toPersianDigits(cleaned).replace(".", "٫"))

    if (cleaned === "" || cleaned === ".") {
      onValueChange(emptyValue)
      return
    }

    const parsed = Number(cleaned)
    if (Number.isFinite(parsed)) onValueChange(parsed)
  }

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      dir="ltr"
      value={text}
      onChange={handleChange}
      onBlur={(event) => {
        setText(formatValue(value, allowDecimal))
        onBlur?.(event)
      }}
      className={props.className}
    />
  )
}
