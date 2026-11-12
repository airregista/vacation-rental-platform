"use client"

import * as React from "react"
import {
  CANCELLATION_POLICY_LABELS,
  describeCancellationPolicy,
  type CancellationPolicy,
} from "@/lib/cancellation-policy"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PersianNumberInput } from "@/components/shared/persian-number-input"

export { CANCELLATION_POLICY_LABELS }
export type { CancellationPolicy }

export const POLICY_OPTIONS: {
  value: CancellationPolicy
  label: string
  hint: string
}[] = [
  {
    value: "flexible",
    label: CANCELLATION_POLICY_LABELS.flexible,
    hint: "بازگشت آسان تا نزدیک به زمان اقامت",
  },
  {
    value: "moderate",
    label: CANCELLATION_POLICY_LABELS.moderate,
    hint: "بازگشت بخشی از مبلغ پیش از اقامت",
  },
  {
    value: "strict",
    label: CANCELLATION_POLICY_LABELS.strict,
    hint: "بازگشت محدود در روزهای نزدیک به اقامت",
  },
  {
    value: "custom",
    label: CANCELLATION_POLICY_LABELS.custom,
    hint: "پنجره و درصد جریمه را خودتان تعیین کنید",
  },
]

export interface PolicySelectorProps {
  value: CancellationPolicy
  onChange: (value: CancellationPolicy) => void
  freeHours?: number
  penaltyPercent?: number
  onFreeHoursChange?: (value: number) => void
  onPenaltyPercentChange?: (value: number) => void
}

export function PolicySelector({
  value,
  onChange,
  freeHours,
  penaltyPercent,
  onFreeHoursChange,
  onPenaltyPercentChange,
}: PolicySelectorProps) {
  const fieldId = React.useId()
  const freeHoursValue = freeHours ?? 24
  const penaltyPercentValue = penaltyPercent ?? 50

  const freeHoursInvalid =
    !Number.isInteger(freeHoursValue) || freeHoursValue < 0
  const penaltyInvalid =
    !Number.isFinite(penaltyPercentValue) ||
    penaltyPercentValue < 0 ||
    penaltyPercentValue > 100

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {POLICY_OPTIONS.map((option) => {
          const isActive = value === option.value
          return (
            <Button
              key={option.value}
              type="button"
              variant={isActive ? "default" : "outline"}
              onClick={() => onChange(option.value)}
              aria-pressed={isActive}
              className={cn(
                "h-auto w-full flex-col items-start justify-center gap-0.5 whitespace-normal rounded-xl px-4 py-3 text-right",
                !isActive && "border-line bg-paper-card hover:bg-paper-deep"
              )}
            >
              <span className="text-sm font-bold">{option.label}</span>
              <span
                className={cn(
                  "text-[11px] font-medium leading-5",
                  isActive ? "text-on-brick/75" : "text-ink-soft"
                )}
              >
                {option.hint}
              </span>
            </Button>
          )
        })}
      </div>

      {value === "custom" ? (
        <div className="rounded-xl border border-line/70 bg-paper-deep/35 p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`${fieldId}-free-hours`}
                className="text-xs font-bold text-ink"
              >
                ساعت لغو رایگان پیش از تحویل
              </label>
              <PersianNumberInput
                id={`${fieldId}-free-hours`}
                min={0}
                value={freeHoursValue}
                onValueChange={(value) =>
                  onFreeHoursChange?.(value ?? 0)
                }
                disabled={!onFreeHoursChange}
                aria-invalid={freeHoursInvalid}
                className="h-11 border-line bg-paper-card tabular-nums"
              />
              <p className="text-[11px] leading-5 text-ink-soft">
                چند ساعت پیش از تحویل، لغو بدون جریمه باشد.
              </p>
              {freeHoursInvalid ? (
                <p className="text-[11px] font-medium text-destructive">
                  ساعت باید عدد صحیح و نامنفی باشد.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${fieldId}-penalty-percent`}
                className="text-xs font-bold text-ink"
              >
                درصد جریمه پس از این مهلت
              </label>
              <PersianNumberInput
                id={`${fieldId}-penalty-percent`}
                min={0}
                max={100}
                allowDecimal
                value={penaltyPercentValue}
                onValueChange={(value) =>
                  onPenaltyPercentChange?.(value ?? 0)
                }
                disabled={!onPenaltyPercentChange}
                aria-invalid={penaltyInvalid}
                className="h-11 border-line bg-paper-card tabular-nums"
              />
              <p className="text-[11px] leading-5 text-ink-soft">
                درصدی از مبلغ اقامت که پس از این مهلت کسر می‌شود.
              </p>
              {penaltyInvalid ? (
                <p className="text-[11px] font-medium text-destructive">
                  درصد جریمه باید بین ۰ تا ۱۰۰ باشد.
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-3 rounded-lg border border-line/60 bg-paper-card px-3 py-2 text-[11px] leading-6 text-ink-soft">
            {describeCancellationPolicy("custom", {
              freeHours: freeHoursValue,
              penaltyPercent: penaltyPercentValue,
            })}
          </p>
        </div>
      ) : null}
    </div>
  )
}
